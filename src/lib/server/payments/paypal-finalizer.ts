import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from './gateway';
import { PayPalService, type PayPalCaptureResult } from './paypal';

export type PayPalPaymentMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay';

function normalizePaymentMethod(value: unknown): PayPalPaymentMethod {
  return value === 'card' || value === 'apple_pay' || value === 'google_pay'
    ? value
    : 'paypal';
}

export async function finalizePayPalCapture(params: {
  paymentId: string;
  orderId: string;
  requestedMethod?: PayPalPaymentMethod;
  capture: PayPalCaptureResult;
}) {
  if (!params.capture.success || !params.capture.captureId || !params.capture.amountUsd) {
    throw new Error(params.capture.error || 'La capture PayPal est incomplète.');
  }
  if (params.capture.currency !== 'USD') {
    throw new Error('La capture PayPal doit être libellée en USD.');
  }

  const supabase = createAdminClient();
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('id', params.paymentId)
    .maybeSingle();

  if (paymentError || !payment) throw new Error('Paiement Kobara introuvable.');
  if (payment.paypal_order_id && payment.paypal_order_id !== params.orderId) {
    throw new Error("L'ordre PayPal ne correspond pas au paiement Kobara.");
  }
  if (payment.status === 'succeeded') {
    if (payment.paypal_capture_id && payment.paypal_capture_id !== params.capture.captureId) {
      throw new Error('Ce paiement a déjà été finalisé par une autre capture.');
    }
    return { payment, transitioned: false };
  }
  if (payment.status !== 'pending') {
    throw new Error(`Ce paiement ne peut plus être finalisé (${payment.status}).`);
  }

  const expectedAmount = Number(payment.amount_usd || 0);
  if (!expectedAmount || Math.abs(expectedAmount - params.capture.amountUsd) > 0.01) {
    throw new Error('Le montant capturé ne correspond pas au montant autorisé.');
  }

  const config = await getPaymentProviderConfig();
  const quotedFee = Number(payment.fee_amount_usd);
  const quotedNet = Number(payment.net_amount_usd);
  const fee = Number.isFinite(quotedFee) && Number.isFinite(quotedNet)
    ? { grossUsd: params.capture.amountUsd, feeUsd: quotedFee, netUsd: quotedNet }
    : PayPalService.calculateFees(
        params.capture.amountUsd,
        config.paypal_fee_percent,
        config.paypal_fee_fixed_usd,
      );
  const paymentMethod = normalizePaymentMethod(
    params.capture.paymentSource || params.requestedMethod || payment.payment_source,
  );

  const metadata = {
    ...(payment.metadata || {}),
    paypal_order_id: params.orderId,
    paypal_capture_id: params.capture.captureId,
    payer_email: params.capture.payerEmail || null,
    payment_source: paymentMethod,
    amount_usd: fee.grossUsd,
    kobara_fee_usd: fee.feeUsd,
    processor_fee_usd: params.capture.processorFeeUsd ?? null,
    net_amount_usd: fee.netUsd,
    htg_per_usd: config.paypal_htg_per_usd,
  };

  const { data: updated, error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      provider: 'paypal',
      payment_method: paymentMethod,
      payment_source: paymentMethod,
      paypal_order_id: params.orderId,
      paypal_capture_id: params.capture.captureId,
      amount_usd: fee.grossUsd,
      fee_amount_usd: fee.feeUsd,
      processor_fee_amount_usd: params.capture.processorFeeUsd ?? null,
      net_amount_usd: fee.netUsd,
      paypal_capture_payload: {
        status: 'COMPLETED',
        capture_id: params.capture.captureId,
        payment_source: paymentMethod,
      },
      metadata,
    })
    .eq('id', payment.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (updateError) {
    console.error('[PayPal] Atomic finalization failed:', updateError);
    throw new Error("Impossible d'enregistrer la capture PayPal.");
  }

  if (!updated) {
    const { data: concurrentPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .maybeSingle();
    if (concurrentPayment?.status === 'succeeded' && concurrentPayment.paypal_capture_id === params.capture.captureId) {
      return { payment: concurrentPayment, transitioned: false };
    }
    throw new Error('Le paiement a changé pendant sa finalisation.');
  }

  const { onPaymentSucceeded } = await import('./on-payment-succeeded');
  await onPaymentSucceeded(updated.id);
  return { payment: updated, transitioned: true };
}
