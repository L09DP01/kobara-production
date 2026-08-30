import { NextRequest, NextResponse } from 'next/server';

import { verifyMobileToken } from '@/lib/auth/mobile-verify';
import {
  createPaymReference,
  normalizePaymAmount,
  withPaymentRoutingMetadata,
  sanitizePaymentRedirectUrl,
} from '@/lib/payment-routing';
import { createPaymentGateway, getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const authResult = await verifyMobileToken(req);
    if (authResult.errorResponse) return authResult.errorResponse;

    const userId = authResult.payload?.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non identifié', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, kyc_status')
      .eq('user_id', userId)
      .single();
    if (!merchant) {
      return NextResponse.json({ error: 'Profil marchand requis', code: 'MERCHANT_REQUIRED' }, { status: 403 });
    }
    if (merchant.kyc_status !== 'approved') return NextResponse.json({ error: 'Verification KYC requise.', code: 'KYC_REQUIRED' }, { status: 403 });

    const { data: subscription, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();
    if (subscriptionError || !subscription) {
      return NextResponse.json({ error: 'Abonnement introuvable', code: 'NOT_FOUND' }, { status: 404 });
    }
    if (Number(subscription.amount_htg) <= 0) {
      return NextResponse.json({ error: 'Ce plan est gratuit.', code: 'INVALID_AMOUNT' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = typeof body.returnUrl === 'string' && body.returnUrl
      ? body.returnUrl
      : 'kobara://payments/success';
    const providerConfig = await getPaymentProviderConfig();
    const amount = providerConfig.active_provider === 'paym'
      ? normalizePaymAmount('natcash', Number(subscription.amount_htg))
      : Number(subscription.amount_htg);
    const reference = createPaymReference('RNW');
    const metadata = {
      is_subscription_upgrade: true,
      plan_slug: subscription.plans?.slug || '',
      billing_cycle: subscription.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      renewed_subscription_id: subscription.id,
      expected_amount: amount,
    };

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        merchant_id: merchant.id,
        amount,
        net_amount: amount,
        currency: 'HTG',
        status: 'pending',
        provider: 'natcash',
        payment_method: 'natcash',
        environment: 'live',
        kobara_reference: reference,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        success_url: returnUrl,
        error_url: returnUrl,
        metadata,
      })
      .select('id')
      .single();
    if (paymentError || !payment) {
      throw new Error("Impossible de créer le paiement de renouvellement NatCash.");
    }

    try {
      let gateway: Awaited<ReturnType<typeof createPaymentGateway>>;
      try {
        gateway = await createPaymentGateway({
          amount,
          reference,
          provider: 'natcash',
          environment: 'live',
          description: `Renouvellement Abonnement Kobara - Plan ${subscription.plans?.name || ''}`,
          successUrl: returnUrl,
          cancelUrl: returnUrl,
          errorUrl: returnUrl,
        });
      } catch (initializationError) {
        const { error: discardError } = await supabase
          .from('payments')
          .delete()
          .eq('id', payment.id)
          .eq('status', 'pending');
        if (discardError) {
          console.error(JSON.stringify({ event: 'discard_uninitialized_mobile_payment_failed', payment_id: payment.id, code: discardError.code }));
        }
        throw initializationError;
      }

      let referenceCode: string | null = null;
      if (gateway.processor === 'sms_gateway') {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const digits = '23456789';
        const pick = (characters: string) => characters[Math.floor(Math.random() * characters.length)];
        referenceCode = `KOB${pick(digits)}${pick(letters)}${pick(digits)}${pick(letters)}${pick(digits)}`;
      }

      const safePaymentUrl = sanitizePaymentRedirectUrl(gateway.paymentUrl);

      const { error: routingError } = await supabase.from('payments').update({
        provider: gateway.route.wallet,
        payment_method: gateway.paymentMethod,
        reference_code: referenceCode,
        metadata: {
          ...withPaymentRoutingMetadata(metadata, gateway.route, gateway.transactionId),
          ...(gateway.processor === 'paym' && safePaymentUrl
            ? { provider_checkout_url: safePaymentUrl }
            : {}),
        },
      }).eq('id', payment.id);
      if (routingError) throw new Error("Impossible d'enregistrer la passerelle NatCash.");

      if (gateway.processor === 'sms_gateway') {
        return NextResponse.json({
          success: true,
          method: 'natcash',
          processor: gateway.processor,
          referenceCode,
          paymentId: payment.id,
        });
      }

      if (!safePaymentUrl) {
        throw new Error("L'API de paiement n'a pas retourné d'URL de redirection.");
      }

      return NextResponse.json({
        success: true,
        method: 'natcash',
        processor: gateway.processor,
        paymentUrl: gateway.processor === 'paym'
          ? `https://pay.kobara.app/redirect/${payment.id}`
          : safePaymentUrl,
        paymentId: payment.id,
      });
    } catch (error) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur interne du serveur';
    console.error(JSON.stringify({ event: 'mobile_natcash_renewal_failed', message }));
    return NextResponse.json({ error: message, code: 'SERVER_ERROR' }, { status: 500 });
  }
}
