import 'server-only';

import { getRecordedPaymentProcessor } from '@/lib/payment-routing';
import { PaymService } from '@/lib/server/paym/paym.service';
import { createAdminClient } from '@/utils/supabase/admin';

type PaymPayment = {
  id: string;
  amount: number | string;
  status: string;
  created_at: string;
  expires_at: string | null;
  environment: string | null;
  kobara_reference: string | null;
  provider: string | null;
  payment_method: string | null;
  reference_code: string | null;
  success_url: string | null;
  error_url: string | null;
  metadata: Record<string, unknown> | null;
};

export type PaymConfirmationResult = {
  payment: PaymPayment | null;
  status: 'succeeded' | 'pending' | 'failed' | 'not_found' | 'invalid';
  message: string;
};

async function findPaymPayment(input: {
  reference?: string | null;
  transactionId?: string | null;
  paymentId?: string | null;
}) {
  const supabase = createAdminClient();
  const columns = 'id, amount, status, created_at, expires_at, environment, kobara_reference, provider, payment_method, reference_code, success_url, error_url, metadata';

  if (input.paymentId) {
    return supabase.from('payments').select(columns).eq('id', input.paymentId).maybeSingle();
  }
  if (input.reference) {
    return supabase.from('payments').select(columns).eq('kobara_reference', input.reference).maybeSingle();
  }
  if (input.transactionId) {
    return supabase
      .from('payments')
      .select(columns)
      .contains('metadata', { provider_transaction_id: input.transactionId })
      .maybeSingle();
  }

  return { data: null, error: null };
}

/**
 * Pay'm does not document a signed payment webhook. Incoming callbacks are
 * therefore treated only as hints: the payment is always verified directly
 * with Pay'm before Kobara changes any financial state.
 */
export async function confirmPaymPayment(input: {
  reference?: string | null;
  transactionId?: string | null;
  paymentId?: string | null;
}): Promise<PaymConfirmationResult> {
  const supabase = createAdminClient();
  const { data, error } = await findPaymPayment(input);
  const payment = data as PaymPayment | null;

  if (error || !payment) {
    return { payment: null, status: 'not_found', message: 'Paiement introuvable.' };
  }
  if (getRecordedPaymentProcessor(payment) !== 'paym' || !payment.kobara_reference) {
    return { payment, status: 'invalid', message: "Ce paiement n'appartient pas à Pay'm." };
  }

  if (payment.status === 'succeeded') {
    // Recover a subscription activation if a previous request stopped after
    // persisting the payment status but before activating the plan.
    if (payment.metadata?.is_subscription_upgrade) {
      const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
      await onPaymentSucceeded(payment.id);
    }
    return { payment, status: 'succeeded', message: 'Paiement déjà confirmé.' };
  }

  const verification = await PaymService.verifyPayment(payment.kobara_reference);
  if (!verification.status || verification.trans_status !== 'ok') {
    return { payment, status: 'pending', message: "Paiement encore en attente chez Pay'm." };
  }

  const expectedAmount = Number(payment.amount);
  const verifiedAmount = Number(verification.montant);
  if (
    payment.environment !== 'test'
    && (!Number.isFinite(verifiedAmount) || Math.abs(verifiedAmount - expectedAmount) > 0.01)
  ) {
    console.error(JSON.stringify({
      event: 'paym_callback_amount_mismatch',
      payment_id: payment.id,
      expected_amount: expectedAmount,
      verified_amount: Number.isFinite(verifiedAmount) ? verifiedAmount : null,
    }));
    return { payment, status: 'failed', message: 'Le montant confirmé ne correspond pas au paiement Kobara.' };
  }

  const { data: updated, error: updateError } = await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      paid_at: new Date().toISOString(),
      bazik_transaction_id: verification.id_transaction || null,
    })
    .eq('id', payment.id)
    .in('status', ['pending', 'expired'])
    .select('id')
    .maybeSingle();

  if (updateError) throw updateError;
  if (updated) {
    const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
    await onPaymentSucceeded(payment.id);
  }

  return {
    payment: { ...payment, status: 'succeeded' },
    status: 'succeeded',
    message: 'Paiement confirmé et traité par Kobara.',
  };
}
