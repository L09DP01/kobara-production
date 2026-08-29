import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { paymentsLimiter, getClientIp } from "@/lib/server/security/rate-limit";
import { getRecordedPaymentProcessor } from "@/lib/payment-routing";
import { isSmsGatewayActive } from "@/lib/server/payments/gateway";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const { success, reset } = await paymentsLimiter.limit(`verify_natcash:${ip}`);
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Trop de tentatives de vérification. Veuillez patienter." },
        { 
          status: 429, 
          headers: { 
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Reset': reset.toString() 
          } 
        }
      );
    }
    const { paymentId, transCode } = await request.json();

    if (!paymentId || typeof transCode !== 'string' || !/^\d{8,32}$/.test(transCode.trim())) {
      return NextResponse.json({ error: "Les informations de paiement sont incomplètes." }, { status: 400 });
    }
    const normalizedTransCode = transCode.trim();

    const supabase = createAdminClient();

    // 1. Vérifier le paiement
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Paiement introuvable, contacter l'administrateur." }, { status: 404 });
    }

    const explicitProcessor = payment.metadata?.payment_processor;
    const isSmsPayment = explicitProcessor === 'sms_gateway' || (
      !explicitProcessor &&
      await isSmsGatewayActive() &&
      getRecordedPaymentProcessor(payment) === 'sms_gateway'
    );

    if (!isSmsPayment) {
      return NextResponse.json({ error: "Ce paiement n'utilise pas le SMS Gateway NatCash." }, { status: 409 });
    }

    // Si le paiement est déjà validé
    if (payment.status === 'succeeded') {
      return NextResponse.json({ success: true, message: "Paiement déjà validé !" });
    }

    if (payment.status !== 'pending' || (payment.expires_at && new Date(payment.expires_at) <= new Date())) {
      return NextResponse.json({ error: "Ce paiement n'est plus actif." }, { status: 409 });
    }

    // 2. Chercher dans sms_inbox si ce transCode a été reçu
    // On utilise ilike sur le raw_message car c'est un numéro unique très long
    const { data: smsList } = await supabase
      .from('sms_inbox')
      .select('*')
      .eq('source', 'natcash')
      .filter('parsed_json->>transCode', 'eq', normalizedTransCode)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!smsList || smsList.length === 0) {
      return NextResponse.json({ 
        error: "Paiement non trouvé, contacter l'administrateur." 
      }, { status: 404 });
    }

    const sms = smsList[0];
    const parsed = sms.parsed_json;

    if (sms.payment_id && sms.payment_id !== payment.id) {
      return NextResponse.json({ error: "Ce code de transaction a déjà été utilisé." }, { status: 409 });
    }

    const normalizeReference = (value: string) =>
      (value || '').toUpperCase().replace(/[O0]/g, '0').replace(/[I1L]/g, '1');
    if (
      !parsed?.referenceCode ||
      normalizeReference(parsed.referenceCode) !== normalizeReference(payment.reference_code)
    ) {
      return NextResponse.json({ error: "Le code de référence NatCash ne correspond pas à ce paiement." }, { status: 400 });
    }

    // Same one-gourde tolerance as automatic SMS matching.
    const receivedAmount = Number(parsed?.amount);
    const expectedAmount = Number(payment.amount);
    if (!Number.isFinite(receivedAmount) || !Number.isFinite(expectedAmount)) {
      return NextResponse.json({ error: "Le montant du SMS NatCash est invalide." }, { status: 400 });
    }
    if (Math.abs(receivedAmount - expectedAmount) > 1) {
      return NextResponse.json({
        error: `Le montant du transfert (${receivedAmount} HTG) ne correspond pas au montant requis (${expectedAmount} HTG). Veuillez contacter l'administrateur.`
      }, { status: 400 });
    }

    if (!sms.payment_id) {
      const { data: claimedSms } = await supabase.from('sms_inbox').update({
        status: 'processed',
        payment_id: payment.id,
        error_reason: 'Validated manually via UI transCode check',
      }).eq('id', sms.id).is('payment_id', null).select('id');

      if (!claimedSms || claimedSms.length === 0) {
        return NextResponse.json({ error: "Ce code de transaction vient d'être utilisé." }, { status: 409 });
      }
    }

    // 3. Valider le paiement
    const { data: updatedVerifyPayments, error: updateError } = await supabase.from('payments').update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      trans_code: normalizedTransCode
    }).eq('id', payment.id).neq('status', 'succeeded').select();

    if (updateError) {
      throw updateError;
    }

    if (!updatedVerifyPayments || updatedVerifyPayments.length === 0) {
      return NextResponse.json({ success: true, message: "Paiement déjà validé en arrière-plan !" });
    }

    // 4. Centralized post-success handler (balance, webhooks, notifications, plan upgrade)
    const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
    await onPaymentSucceeded(payment.id);

    return NextResponse.json({ success: true, message: "Paiement validé avec succès !" });

  } catch (error: any) {
    console.error("verify-natcash error:", error);
    return NextResponse.json({ error: "Erreur interne, contacter l'administrateur." }, { status: 500 });
  }
}
