import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getRecordedPaymentProcessor } from "@/lib/payment-routing";
import { isSmsGatewayActive } from "@/lib/server/payments/gateway";
import { getClientIp, paymentsLimiter } from "@/lib/server/security/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip = getClientIp(request.headers);
    const { success, reset } = await paymentsLimiter.limit(`claim_natcash:${ip}`);
    if (!success) {
      return NextResponse.json(
        { error: "Trop de tentatives de vérification. Veuillez patienter." },
        {
          status: 429,
          headers: { 'Retry-After': Math.max(1, Math.ceil((reset - Date.now()) / 1000)).toString() },
        },
      );
    }

    const resolvedParams = await params;
    const paymentId = resolvedParams.id;
    
    const body = await request.json();
    const { transCode } = body;

    if (typeof transCode !== 'string' || !/^\d{8,32}$/.test(transCode.trim())) {
      return NextResponse.json({ error: "TransCode manquant" }, { status: 400 });
    }
    const normalizedTransCode = transCode.trim();

    const supabaseAdmin = createAdminClient();

    // 1. Fetch the payment details
    const { data: payment, error: pError } = await supabaseAdmin
      .from('payments')
      .select('id, amount, status, expires_at, provider, payment_method, reference_code, metadata')
      .eq('id', paymentId)
      .single();

    if (pError || !payment) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    if (payment.status === 'succeeded') {
      return NextResponse.json({ success: true, message: "Déjà payé" }, { status: 200 });
    }

    if (payment.status !== 'pending' || (payment.expires_at && new Date(payment.expires_at) <= new Date())) {
      return NextResponse.json({ error: "Ce paiement n'est plus actif." }, { status: 409 });
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

    // 2. Search for the SMS in the inbox using the exact transCode
    const { data: smsList, error: smsError } = await supabaseAdmin
      .from('sms_inbox')
      .select('id, raw_message, parsed_json, status, payment_id')
      .eq('source', 'natcash')
      .filter('parsed_json->>transCode', 'eq', normalizedTransCode)
      .limit(1);

    if (smsError) {
      console.error("Erreur recherche SMS:", smsError);
      return NextResponse.json({ error: "Erreur serveur lors de la vérification" }, { status: 500 });
    }

    if (!smsList || smsList.length === 0) {
      return NextResponse.json({ error: "Ce code de transaction (TransCode) est introuvable." }, { status: 404 });
    }

    // Check if SMS was already linked to another successful payment
    const sms = smsList[0];
    if (sms.payment_id && sms.payment_id !== payment.id) {
      return NextResponse.json({ error: "Ce paiement a déjà été utilisé pour une autre transaction." }, { status: 400 });
    }

    const parsed = sms.parsed_json as {
      amount?: number | null;
      referenceCode?: string | null;
    } | null;

    const normalizeReference = (value: string | null | undefined) =>
      (value || '').toUpperCase().replace(/[O0]/g, '0').replace(/[I1L]/g, '1');
    if (
      !parsed?.referenceCode ||
      normalizeReference(parsed.referenceCode) !== normalizeReference(payment.reference_code)
    ) {
      return NextResponse.json({ error: "Le code de référence NatCash ne correspond pas à ce paiement." }, { status: 400 });
    }

    // 3. Verify that the amount matches with a small tolerance (1 HTG)
    const receivedAmount = Number(parsed.amount);
    const expectedAmount = Number(payment.amount);
    if (!Number.isFinite(receivedAmount) || !Number.isFinite(expectedAmount)) {
      return NextResponse.json({ error: "Données du SMS invalides" }, { status: 500 });
    }

    const amountDiff = Math.abs(expectedAmount - receivedAmount);
    if (amountDiff > 1) {
      return NextResponse.json({ 
        error: `Montant incorrect. Le transfert était de ${receivedAmount} HTG.`
      }, { status: 400 });
    }

    // Claim the SMS first so concurrent requests cannot reuse it.
    if (!sms.payment_id) {
      const { data: claimedSms } = await supabaseAdmin.from('sms_inbox').update({
        status: 'processed',
        error_reason: 'Récupéré manuellement via TransCode client',
        payment_id: payment.id,
      }).eq('id', sms.id).is('payment_id', null).select('id');

      if (!claimedSms || claimedSms.length === 0) {
        return NextResponse.json({ error: "Ce code de transaction vient d'être utilisé." }, { status: 409 });
      }
    }

    // 4. Update the payment as succeeded
    const { data: updatedClaimPayments, error: updateError } = await supabaseAdmin.from('payments').update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      trans_code: normalizedTransCode
    }).eq('id', payment.id).neq('status', 'succeeded').select();

    if (updateError) {
      throw updateError;
    }

    if (!updatedClaimPayments || updatedClaimPayments.length === 0) {
      return NextResponse.json({ success: true, message: "Déjà payé en arrière-plan" }, { status: 200 });
    }

    // 5. Centralized post-success handler (balance, webhooks, notifications, plan upgrade)
    const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
    await onPaymentSucceeded(payment.id);

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("Erreur claim-transcode:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
