import { createHmac, timingSafeEqual } from 'node:crypto';

export const KOBARA_CRYPTO_CURRENCIES = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', networkGroup: 'bitcoin' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', networkGroup: 'ethereum' },
  { id: 'trx', symbol: 'TRX', name: 'TRON', network: 'TRON', networkGroup: 'tron' },
  { id: 'ton', symbol: 'TON', name: 'Toncoin', network: 'TON', networkGroup: 'ton' },
  { id: 'bnbbsc', symbol: 'BNB', name: 'BNB', network: 'BSC', networkGroup: 'bsc' },
  { id: 'usdttrc20', symbol: 'USDT', name: 'Tether USD', network: 'TRON', networkGroup: 'tron' },
  { id: 'usdterc20', symbol: 'USDT', name: 'Tether USD', network: 'Ethereum', networkGroup: 'ethereum' },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', network: 'Ethereum', networkGroup: 'ethereum' },
  { id: 'usdtbsc', symbol: 'USDT', name: 'Tether USD', network: 'BSC', networkGroup: 'bsc' },
  { id: 'pyusd', symbol: 'PYUSD', name: 'PayPal USD', network: 'Ethereum', networkGroup: 'ethereum' },
  { id: 'usdcbsc', symbol: 'USDC', name: 'USD Coin', network: 'BSC', networkGroup: 'bsc' },
] as const;

export type KobaraCryptoCurrency = (typeof KOBARA_CRYPTO_CURRENCIES)[number];
export type KobaraCryptoCurrencyId = KobaraCryptoCurrency['id'];

export const CRYPTO_PAYMENT_WINDOW_MS = 20 * 60 * 1000;

export function getCryptoPaymentExpiresAt(providerValidUntil?: string | null, now = Date.now()): string {
  const providerTimestamp = providerValidUntil ? Date.parse(providerValidUntil) : Number.NaN;
  const kobaraDeadline = now + CRYPTO_PAYMENT_WINDOW_MS;
  if (Number.isFinite(providerTimestamp) && providerTimestamp > now) {
    return new Date(Math.min(providerTimestamp, kobaraDeadline)).toISOString();
  }
  return new Date(kobaraDeadline).toISOString();
}

const KOBARA_CRYPTO_CURRENCY_IDS = new Set<string>(KOBARA_CRYPTO_CURRENCIES.map((currency) => currency.id));

export function isKobaraCryptoCurrency(value: unknown): value is KobaraCryptoCurrencyId {
  return typeof value === 'string' && KOBARA_CRYPTO_CURRENCY_IDS.has(value.trim().toLowerCase());
}

export function getKobaraCryptoCurrency(value: string): KobaraCryptoCurrency | null {
  const normalized = value.trim().toLowerCase();
  return KOBARA_CRYPTO_CURRENCIES.find((currency) => currency.id === normalized) || null;
}

export function getCryptoWithdrawalMinimumUsd(currencyId: KobaraCryptoCurrencyId): number {
  const currency = getKobaraCryptoCurrency(currencyId);
  if (!currency) throw new Error('Devise crypto non supportée.');
  if (currency.networkGroup === 'bitcoin') return 25;
  if (currency.networkGroup === 'ethereum') return 50;
  return 10;
}

export type NowPaymentsStatus =
  | 'waiting'
  | 'confirming'
  | 'confirmed'
  | 'sending'
  | 'partially_paid'
  | 'finished'
  | 'failed'
  | 'refunded'
  | 'expired';

export function sortObjectDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectDeep);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value as Record<string, unknown>)
    .sort()
    .reduce<Record<string, unknown>>((sorted, key) => {
      sorted[key] = sortObjectDeep((value as Record<string, unknown>)[key]);
      return sorted;
    }, {});
}

export function signNowPaymentsPayload(payload: unknown, secret: string): string {
  return createHmac('sha512', secret.trim())
    .update(JSON.stringify(sortObjectDeep(payload)))
    .digest('hex');
}

export function verifyNowPaymentsSignature(
  payload: unknown,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = signNowPaymentsPayload(payload, secret);
  const providedBuffer = Buffer.from(signature.toLowerCase(), 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function isNowPaymentsTerminalFailure(status: string): boolean {
  return status === 'failed' || status === 'expired' || status === 'refunded';
}

export function convertPaymentAmountToUsd(
  amount: number,
  currency: string,
  htgPerUsd: number,
): number {
  if (currency.toUpperCase() === 'USD') return Number(amount.toFixed(2));
  if (!Number.isFinite(htgPerUsd) || htgPerUsd <= 0) {
    throw new Error('Le taux HTG/USD est invalide.');
  }
  return Number((amount / htgPerUsd).toFixed(2));
}
