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
};

export function shopifyOrderId(order: ShopifyOrderInput): string {
  const id = String(order.id ?? order.admin_graphql_api_id?.split('/').pop() ?? '');
  if (!/^\d+$/.test(id)) throw new Error('Identifiant de commande Shopify invalide.');
  return id;
}

export function shopifyOrderAmount(order: ShopifyOrderInput): number {
  return Number(order.current_total_price ?? order.total_price ?? NaN);
}

export function canCollectShopifyOrder(order: ShopifyOrderInput): boolean {
  return order.test !== true && !order.cancelled_at
    && order.currency === 'HTG'
    && Number.isFinite(shopifyOrderAmount(order)) && shopifyOrderAmount(order) > 0
    && order.financial_status === 'pending'
    && Array.isArray(order.payment_gateway_names)
    && order.payment_gateway_names.some(name => typeof name === 'string' && name.trim().toLowerCase() === 'kobara');
}

export function isMatchingShopifyPayment(
  payment: { id: string; merchant_id: string; payment_link_id?: string | null; status: string; environment?: string; currency: string; amount: number | string },
  order: { merchant_id: string; payment_link_id: string | null; currency: string; total_amount: number | string; kobara_status: string },
): boolean {
  const paid = Number(payment.amount);
  const expected = Number(order.total_amount);
  return payment.environment === 'live' && payment.status === 'succeeded'
    && payment.merchant_id === order.merchant_id
    && Boolean(payment.payment_link_id) && payment.payment_link_id === order.payment_link_id
    && payment.currency === 'HTG' && order.currency === 'HTG'
    && Number.isFinite(paid) && Number.isFinite(expected) && expected > 0
    && Math.round(paid * 100) === Math.round(expected * 100)
    && order.kobara_status !== 'cancelled';
}
