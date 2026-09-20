import { createAdminClient } from "@/utils/supabase/admin";
import {
  getPaymentMethodLabel,
  getSettlementAmounts,
  withSettlementAuditMetadata,
} from '@/lib/payment-settlement';

/**
 * Centralized handler for when a payment succeeds.
 * Handles:
 * 1. Sending signed webhooks to merchant endpoints
 * 2. Sending notifications
 * 3. Upgrading plans (if subscription payment)
 *
 * The database transition trigger is the only balance-crediting mechanism.
 * 
 * This should be called from ALL payment confirmation paths:
 * - Bazik webhook (MonCash)
 * - NatCash SMS webhook
 * - verify-natcash (manual TransCode)
 * - claim-transcode (client TransCode)
 */
export async function onPaymentSucceeded(paymentId: string) {
  const supabase = createAdminClient();

  // Fetch the full payment
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (fetchError || !payment) {
    console.error(`onPaymentSucceeded: Payment ${paymentId} not found`, fetchError);
    return;
  }

  // Guard: only process if payment is actually succeeded
  if (payment.status !== 'succeeded') {
    console.warn(`onPaymentSucceeded: Payment ${paymentId} status is ${payment.status}, skipping`);
    return;
  }

  // --- 1. Check if it's a subscription upgrade ---
  const merchantId = payment.merchant_id;
  const metadata = payment.metadata as {
    is_subscription_upgrade?: boolean;
    plan_slug?: string;
    billing_cycle?: string;
    promo_code_id?: string;
  } | null;
  if (metadata && metadata.is_subscription_upgrade && metadata.plan_slug) {
    const { data: existingActivation } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('payment_id', payment.id)
      .maybeSingle();
    if (existingActivation) {
      try {
        const { processPartnerPlanActivation } = await import('@/lib/server/partners/program');
        await processPartnerPlanActivation({
          merchantId,
          subscriptionId: existingActivation.id,
          planSlug: metadata.plan_slug,
        });
      } catch (partnerError) {
        console.error('Partner plan activation retry failed:', partnerError);
      }
      return;
    }

    const { upgradeMerchantPlan } = await import("@/lib/server/plans");
    await upgradeMerchantPlan(merchantId, metadata.plan_slug, {
      billingCycle: metadata.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
      amountHTG: Number(payment.amount || 0),
      paymentStatus: 'paid',
      paymentId: payment.id,
      source: 'provider',
      promoCodeId: metadata.promo_code_id || null,
      paymentLabel: payment.payment_method === 'natcash'
        ? 'NatCash'
        : payment.payment_method === 'moncash' || payment.payment_method === 'moncash_ussd'
          ? 'MonCash'
          : 'paiement mobile',
    });
    // Notifier immédiatement le marchand sur Telegram
    try {
      const { TelegramNotifierService } = await import("@/lib/server/telegram/telegram-notifier.service");
      await TelegramNotifierService.notifySubscriptionActivated(merchantId, metadata.plan_slug, payment.id);
    } catch (telErr) {
      console.error("Telegram subscription notification failed:", telErr);
    }

    // Don't send merchant webhooks for internal subscription payments
    return;
  }

  const settlement = getSettlementAmounts(payment);
  let settledPayment = payment;
  if (
    String(payment.currency || '').toUpperCase() !== settlement.currency
    || Number(payment.amount) !== settlement.gross
    || Number(payment.fee_amount) !== settlement.fee
    || Number(payment.net_amount) !== settlement.net
  ) {
    const { data: normalizedPayment, error: normalizationError } = await supabase
      .from('payments')
      .update({
        amount: settlement.gross,
        fee_amount: settlement.fee,
        net_amount: settlement.net,
        currency: settlement.currency,
        metadata: withSettlementAuditMetadata(payment, settlement.currency),
      })
      .eq('id', payment.id)
      .eq('status', 'succeeded')
      .select('*')
      .maybeSingle();

    if (normalizationError) {
      console.error(`onPaymentSucceeded: settlement normalization failed for ${paymentId}`, normalizationError);
    } else if (normalizedPayment) {
      settledPayment = normalizedPayment;
    }
  }

  const settledAmounts = getSettlementAmounts(settledPayment);
  const paymentMethodLabel = getPaymentMethodLabel(settledPayment);

  try {
    const { processPartnerPaymentSuccess } = await import('@/lib/server/partners/program');
    await processPartnerPaymentSuccess(settledPayment);
  } catch (partnerError) {
    console.error('Partner payment processing failed:', partnerError);
  }

  // --- 2. Send Notification ---
  try {
    const { data: merchantData } = await supabase
      .from('merchants')
      .select('email')
      .eq('id', merchantId)
      .single();

    if (merchantData?.email) {
      const { notifyPaymentSucceeded } = await import("@/lib/server/notifications");
      await notifyPaymentSucceeded({
        merchantId,
        email: merchantData.email,
        amount: settledAmounts.gross,
        netAmount: settledAmounts.net,
        currency: settledAmounts.currency,
        paymentMethod: paymentMethodLabel,
        paymentId: settledPayment.id,
      });
    }
  } catch (e) {
    console.error("Notification failed:", e);
  }

  // --- 3. Send Signed Webhooks to Merchant Endpoints (Strict Environment Isolation) ---
  try {
    const { dispatchMerchantWebhook } = await import("@/lib/server/webhooks/dispatcher");
    await dispatchMerchantWebhook({
      merchantId,
      environment: payment.environment === 'live' ? 'live' : 'test',
      eventType: 'payment.succeeded',
      data: {
        id: settledPayment.id,
        reference: settledPayment.kobara_reference,
        amount: settledPayment.amount,
        net_amount: settledPayment.net_amount,
        fee_amount: settledPayment.fee_amount,
        amount_usd: settledPayment.amount_usd,
        net_amount_usd: settledPayment.net_amount_usd,
        fee_amount_usd: settledPayment.fee_amount_usd,
        currency: settledPayment.currency,
        status: 'succeeded',
        provider: settledPayment.provider,
        payment_method: settledPayment.payment_method,
        payment_method_label: paymentMethodLabel,
        paid_at: settledPayment.paid_at,
        metadata: settledPayment.metadata,
        customer_id: settledPayment.customer_id,
      },
    });
  } catch (e) {
    console.error("Webhook dispatch failed:", e);
  }

  // --- 4. Send Instant Telegram Push Notification (Strictly LIVE only) ---
  try {
    const { TelegramNotifierService } = await import("@/lib/server/telegram/telegram-notifier.service");
    await TelegramNotifierService.notifyPaymentReceived(settledPayment.id);
  } catch (telegramErr) {
    console.error("Telegram notification failed:", telegramErr);
  }
}
