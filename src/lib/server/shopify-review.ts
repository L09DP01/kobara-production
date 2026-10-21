import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { isReviewAccount } from '@/lib/review-account';
import { canCollectShopifyOrder, matchesShopifyCollectionAmount, shopifyExchangeRate } from '@/lib/shopify-policy';

export async function simulateReviewPayment(link: {
  id: string; merchant_id: string; amount: number | string | null; metadata?: Record<string, any>;
}, submittedAmount: string) {
  const db = createAdminClient();
  const { data: merchant, error } = await db.from('merchants').select('*').eq('id', link.merchant_id).maybeSingle();
  if (error || !merchant) throw new Error('Compte marchand indisponible.');
  if (!isReviewAccount(merchant)) return null;
  if (merchant.status === 'suspended' || ['suspended', 'permanently_closed'].includes(merchant.account_access || '')) throw new Error('Compte indisponible.');
  const amount = Number(link.amount ?? submittedAmount);
  if (!Number.isFinite(amount) || amount < 10 || !Number.isSafeInteger(Math.round(amount * 100))) throw new Error('Montant invalide.');
  if (link.metadata?.source === 'shopify') {
    const { data: order } = await db.from('shopify_orders').select('currency, total_amount, raw_order, kobara_status')
      .eq('merchant_id', link.merchant_id).eq('payment_link_id', link.id).maybeSingle();
    if (!order || !['payment_link_ready', 'paid'].includes(order.kobara_status)
      || !canCollectShopifyOrder({ ...order.raw_order, test: false })
      || !matchesShopifyCollectionAmount(order, amount, shopifyExchangeRate(link.metadata.exchange_rate))) {
      throw new Error('Commande de démonstration non concordante.');
    }
  }
  // One deterministic reference per link prevents duplicate simulated credits.
  const reference = `REVIEW${link.id.replace(/-/g, '')}`;
  let { data: payment } = await db.from('payments').select('id, status').eq('kobara_reference', reference)
    .eq('merchant_id', link.merchant_id).eq('environment', 'test').maybeSingle();
  if (!payment) {
    const result = await db.from('payments').insert({ merchant_id: link.merchant_id, payment_link_id: link.id,
      kobara_reference: reference, amount, fee_amount: 0, net_amount: amount, currency: 'HTG',
      status: 'pending', environment: 'test', provider: 'moncash', payment_method: 'moncash',
      metadata: { shopify_review: true, payment_processor: 'simulation' },
    }).select('id, status').single();
    if (result.error?.code === '23505') {
      const existing = await db.from('payments').select('id, status').eq('kobara_reference', reference)
        .eq('merchant_id', link.merchant_id).eq('environment', 'test').maybeSingle();
      payment = existing.data;
    } else if (result.error) throw new Error('Simulation indisponible.');
    else payment = result.data;
  }
  if (!payment) throw new Error('Simulation indisponible.');
  if (payment.status === 'pending') {
    const { error: updateError } = await db.from('payments').update({ status: 'succeeded', paid_at: new Date().toISOString() })
      .eq('id', payment.id).eq('environment', 'test').eq('status', 'pending');
    if (updateError) throw new Error('Confirmation de simulation indisponible.');
  } else if (payment.status !== 'succeeded') throw new Error('Simulation déjà terminée.');
  if (link.metadata?.source === 'shopify') {
    const { reconcileShopifyPayment } = await import('@/lib/server/shopify');
    await reconcileShopifyPayment(payment.id, link.id);
  }
  return { redirectUrl: `/pay/review/${payment.id}` };
}
