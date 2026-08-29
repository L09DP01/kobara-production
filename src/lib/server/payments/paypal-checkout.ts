import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from './gateway';
import { PayPalService } from './paypal';
import type { PayPalPaymentMethod } from './paypal-finalizer';

const PAYPAL_METHODS = new Set<PayPalPaymentMethod>(['card', 'paypal', 'apple_pay', 'google_pay']);

export function normalizePayPalMethod(value: unknown): PayPalPaymentMethod {
  return PAYPAL_METHODS.has(value as PayPalPaymentMethod)
    ? value as PayPalPaymentMethod
    : 'paypal';
}

export async function getPayPalCheckoutPayment(paymentId: string) {
  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('*, merchants(id, paypal_enabled, has_usd_account)')
    .eq('id', paymentId)
    .maybeSingle();

  if (error || !payment) throw new Error('Paiement introuvable.');
  if (payment.status !== 'pending') throw new Error("Ce paiement n'est plus en attente.");
  if (payment.expires_at && new Date(payment.expires_at).getTime() <= Date.now()) {
    throw new Error('Ce paiement a expiré.');
  }

  const merchant = payment.merchants;
  const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
  if (!usdAccount.isActive) {
    throw new Error('Les paiements internationaux ne sont pas activés pour ce marchand.');
  }

  return payment;
}

export async function createPayPalOrderForPayment(
  paymentId: string,
  requestedMethod: PayPalPaymentMethod,
  payer?: { name?: string; email?: string },
) {
  const payment = await getPayPalCheckoutPayment(paymentId);
  const supabase = createAdminClient();
  const config = await getPaymentProviderConfig();
  const amountUsd = PayPalService.convertHtgToUsd(Number(payment.amount), config.paypal_htg_per_usd);
  const fee = PayPalService.calculateFees(
    amountUsd,
    config.paypal_fee_percent,
    config.paypal_fee_fixed_usd,
  );

  if (payment.paypal_order_id) {
    await supabase
      .from('payments')
      .update({ payment_source: requestedMethod })
      .eq('id', payment.id)
      .eq('status', 'pending');
    return { orderId: payment.paypal_order_id, amountUsd };
  }

  const checkoutOrigin = 'https://pay.kobara.app';
  const order = await PayPalService.createOrder({
    paymentId: payment.id,
    reference: payment.kobara_reference,
    amountUsd,
    paymentMethod: requestedMethod,
    description: `Paiement Kobara ${payment.kobara_reference}`,
    payerName: payer?.name || payment.metadata?.customer_name,
    payerEmail: payer?.email || payment.metadata?.customer_email,
    returnUrl: `${checkoutOrigin}/checkout/${payment.id}?paypal_return=1`,
    cancelUrl: `${checkoutOrigin}/checkout/${payment.id}?paypal_cancel=1`,
    environment: payment.environment === 'live' ? 'live' : 'test',
  });

  const { data: persisted, error: persistError } = await supabase
    .from('payments')
    .update({
      provider: 'paypal',
      payment_method: requestedMethod,
      payment_source: requestedMethod,
      paypal_order_id: order.orderId,
      amount_usd: fee.grossUsd,
      fee_amount_usd: fee.feeUsd,
      net_amount_usd: fee.netUsd,
      metadata: {
        ...(payment.metadata || {}),
        payment_processor: 'paypal',
        payment_source: requestedMethod,
        amount_usd: fee.grossUsd,
        kobara_fee_usd: fee.feeUsd,
        net_amount_usd: fee.netUsd,
        htg_per_usd: config.paypal_htg_per_usd,
      },
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .is('paypal_order_id', null)
    .select('paypal_order_id')
    .maybeSingle();

  if (persistError) {
    console.error('[PayPal] Failed to bind order:', persistError);
    throw new Error("Impossible de relier l'ordre au paiement Kobara.");
  }
  if (!persisted) {
    const { data: concurrent } = await supabase
      .from('payments')
      .select('paypal_order_id')
      .eq('id', payment.id)
      .maybeSingle();
    if (concurrent?.paypal_order_id) {
      return { orderId: concurrent.paypal_order_id, amountUsd };
    }
    throw new Error("Impossible d'enregistrer l'ordre PayPal.");
  }

  return { orderId: order.orderId, amountUsd };
}
