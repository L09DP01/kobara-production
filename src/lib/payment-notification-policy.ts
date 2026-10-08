export function shouldNotifyMerchantPayment(payment: { status: string; environment: string; payment_link_id?: string | null; metadata?: Record<string, unknown> | null }) {
  return payment.status === 'succeeded' && payment.environment === 'live' && Boolean(payment.payment_link_id) && !payment.metadata?.is_subscription_upgrade;
}

export function getPayerReceiptEmail(metadata: Record<string, unknown>, customerEmail?: string | null) {
  const value = Object.prototype.hasOwnProperty.call(metadata, 'customer_email') ? metadata.customer_email : customerEmail;
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? value.trim() : null;
}
