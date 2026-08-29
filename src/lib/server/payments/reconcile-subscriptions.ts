import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getRecordedPaymentProcessor } from '@/lib/payment-routing';
import { confirmPaymPayment } from '@/lib/server/payments/confirm-paym-payment';

async function reconcilePendingPaymPaymentsInternal(options: {
  merchantId?: string;
  subscriptionsOnly: boolean;
}) {
  const supabase = createAdminClient();
  let query = supabase
    .from('payments')
    .select('id, merchant_id, amount, status, expires_at, environment, kobara_reference, provider, payment_method, metadata')
    .in('status', ['pending', 'expired']);

  if (options.subscriptionsOnly) query = query.contains('metadata', { is_subscription_upgrade: true });
  if (options.merchantId) query = query.eq('merchant_id', options.merchantId);
  const { data: payments, error } = await query.limit(100);
  if (error) throw new Error(`Impossible de vérifier les paiements d'abonnement: ${error.message}`);

  let checked = 0;
  let activated = 0;
  for (const payment of payments || []) {
    if (!payment.kobara_reference || getRecordedPaymentProcessor(payment) !== 'paym') continue;
    checked++;

    try {
      const confirmation = await confirmPaymPayment({ paymentId: payment.id });
      if (confirmation.status === 'succeeded') activated++;
    } catch (paymentError) {
      console.error(JSON.stringify({
        event: 'subscription_payment_reconciliation_failed',
        payment_id: payment.id,
        message: paymentError instanceof Error ? paymentError.message : String(paymentError),
      }));
    }
  }

  return { checked, activated };
}

export async function reconcilePendingSubscriptionPayments(merchantId?: string) {
  return reconcilePendingPaymPaymentsInternal({ merchantId, subscriptionsOnly: true });
}

export async function reconcilePendingPaymPayments(merchantId?: string) {
  return reconcilePendingPaymPaymentsInternal({ merchantId, subscriptionsOnly: false });
}
