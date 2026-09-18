export type SettlementCurrency = 'HTG' | 'USD';

type PaymentLike = {
  amount?: number | string | null;
  fee_amount?: number | string | null;
  net_amount?: number | string | null;
  amount_usd?: number | string | null;
  fee_amount_usd?: number | string | null;
  net_amount_usd?: number | string | null;
  currency?: string | null;
  provider?: string | null;
  payment_method?: string | null;
  payment_source?: string | null;
  metadata?: Record<string, unknown> | null;
};

const USD_METHODS = new Set(['card', 'paypal', 'apple_pay', 'google_pay']);
const HTG_METHODS = new Set(['moncash', 'moncash_ussd', 'natcash', 'natcash_ussd', 'paym', 'bazik', 'sms_gateway']);

function normalize(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveSettlementCurrency(payment: PaymentLike): SettlementCurrency {
  const provider = normalize(payment.provider);
  const method = normalize(payment.payment_method);
  const source = normalize(payment.payment_source);

  if (provider === 'crypto' || provider === 'paypal' || USD_METHODS.has(method) || USD_METHODS.has(source)) {
    return 'USD';
  }
  if (HTG_METHODS.has(provider) || HTG_METHODS.has(method) || HTG_METHODS.has(source)) {
    return 'HTG';
  }
  return String(payment.currency || '').toUpperCase() === 'USD' ? 'USD' : 'HTG';
}

export function getSettlementAmounts(payment: PaymentLike) {
  const currency = resolveSettlementCurrency(payment);
  const gross = currency === 'USD'
    ? numberOrNull(payment.amount_usd) ?? numberOrNull(payment.amount) ?? 0
    : numberOrNull(payment.amount) ?? 0;
  const fee = currency === 'USD'
    ? numberOrNull(payment.fee_amount_usd) ?? numberOrNull(payment.fee_amount) ?? 0
    : numberOrNull(payment.fee_amount) ?? 0;
  const net = currency === 'USD'
    ? numberOrNull(payment.net_amount_usd) ?? Math.max(0, gross - fee)
    : numberOrNull(payment.net_amount) ?? Math.max(0, gross - fee);

  return { currency, gross, fee, net };
}

export function getPaymentMethodLabel(payment: Pick<PaymentLike, 'provider' | 'payment_method' | 'payment_source'>) {
  const provider = normalize(payment.provider);
  const method = normalize(payment.payment_method || payment.payment_source || payment.provider);

  if (provider === 'crypto') return method && method !== 'crypto' ? `Crypto (${method.toUpperCase()})` : 'Crypto';
  if (method === 'moncash' || method === 'moncash_ussd') return 'MonCash';
  if (method === 'natcash' || method === 'natcash_ussd') return 'NatCash';
  if (method === 'card') return 'Carte bancaire';
  if (method === 'paypal') return 'PayPal';
  if (method === 'apple_pay') return 'Apple Pay';
  if (method === 'google_pay') return 'Google Pay';
  if (method === 'paym') return "Pay'm";
  return method ? method.toUpperCase() : 'Non précisé';
}

export function withSettlementAuditMetadata(payment: PaymentLike, settlementCurrency: SettlementCurrency) {
  const metadata = payment.metadata || {};
  const original = metadata.original_quote && typeof metadata.original_quote === 'object'
    ? metadata.original_quote
    : {
        amount: numberOrNull(payment.amount),
        fee_amount: numberOrNull(payment.fee_amount),
        net_amount: numberOrNull(payment.net_amount),
        currency: String(payment.currency || 'HTG').toUpperCase(),
      };

  return {
    ...metadata,
    original_quote: original,
    settlement_currency: settlementCurrency,
  };
}
