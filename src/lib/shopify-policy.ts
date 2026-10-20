export type ShopifyOrderInput = {
  id?: string | number;
  admin_graphql_api_id?: string;
  currency?: string;
  total_price?: string | number;
  current_total_price?: string | number;
  financial_status?: string;
  payment_gateway_names?: string[];
  cancelled_at?: string | null;
  test?: boolean;
  line_items?: Array<{ title?: string; name?: string; quantity?: number }>;
};

export function shopifyProductName(order: ShopifyOrderInput): string | null {
  const names = (order.line_items || []).map(item => (item.title || item.name || '').trim()).filter(Boolean);
  return names.length ? names.join(' · ') : null;
}

export function matchesShopifyCollectionAmount(order: { currency: string; total_amount: number | string }, amount: number | string): boolean {
  const expected = shopifyCollectionAmount({ currency: order.currency, total_price: order.total_amount });
  return Number.isFinite(expected) && expected > 0 && Number.isFinite(Number(amount))
    && Math.round(expected * 100) === Math.round(Number(amount) * 100);
}

export function shopifyOrderId(order: ShopifyOrderInput): string {
  const id = String(order.id ?? order.admin_graphql_api_id?.split('/').pop() ?? '');
  if (!/^\d+$/.test(id)) throw new Error('Identifiant de commande Shopify invalide.');
  return id;
}

export function shopifyOrderAmount(order: ShopifyOrderInput): number {
  return Number(order.current_total_price ?? order.total_price ?? NaN);
}

export const SHOPIFY_USD_HTG_RATE = 130;

export function shopifyCollectionAmount(order: ShopifyOrderInput): number {
  const amount = shopifyOrderAmount(order);
  if (!['HTG', 'USD'].includes(order.currency || '') || !Number.isFinite(amount) || amount <= 0) return NaN;
  return Math.round(amount * (order.currency === 'USD' ? SHOPIFY_USD_HTG_RATE : 1) * 100) / 100;
}

export function canCollectShopifyOrder(order: ShopifyOrderInput): boolean {
  return order.test !== true && !order.cancelled_at
    && Number.isFinite(shopifyCollectionAmount(order)) && shopifyCollectionAmount(order) > 0
    && order.financial_status === 'pending'
    && Array.isArray(order.payment_gateway_names)
    && order.payment_gateway_names.some(name => typeof name === 'string' && name.trim().toLowerCase() === 'kobara');
}

export function isMatchingShopifyPayment(
  payment: { id: string; merchant_id: string; payment_link_id?: string | null; status: string; environment?: string; currency: string; amount: number | string },
  order: { merchant_id: string; payment_link_id: string | null; currency: string; total_amount: number | string; kobara_status: string },
): boolean {
  const paid = Number(payment.amount);
  const expected = shopifyCollectionAmount({ currency: order.currency, total_price: order.total_amount });
  return payment.environment === 'live' && payment.status === 'succeeded'
    && payment.merchant_id === order.merchant_id
    && Boolean(payment.payment_link_id) && payment.payment_link_id === order.payment_link_id
    && payment.currency === 'HTG'
    && Number.isFinite(paid) && Number.isFinite(expected) && expected > 0
    && Math.round(paid * 100) === Math.round(expected * 100)
    && order.kobara_status !== 'cancelled';
}
