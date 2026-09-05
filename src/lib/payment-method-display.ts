export function getPaymentMethodDisplay(
  paymentMethod?: string | null,
  provider?: string | null,
): string {
  const method = paymentMethod?.toLowerCase().trim() || '';
  const source = provider?.toLowerCase().trim() || '';
  const value = `${method} ${source}`;

  if (value.includes('b2b')) return 'Transfert B2B';
  if (value.includes('natcash')) return 'NatCash';
  if (value.includes('moncash')) return 'MonCash';
  if (value.includes('paypal')) return 'PayPal';
  if (value.includes('apple_pay')) return 'Apple Pay';
  if (value.includes('google_pay')) return 'Google Pay';
  if (value.includes('card') || value.includes('carte')) return 'Carte';
  return paymentMethod || provider || 'Paiement';
}
