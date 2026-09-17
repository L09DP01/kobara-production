import { createHmac, timingSafeEqual } from 'node:crypto';

export const KOBARA_CRYPTO_CURRENCIES = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', networkGroup: 'bitcoin', logo: '/crypto/btc.png' },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', network: 'Ethereum', networkGroup: 'ethereum', logo: '/crypto/eth.png' },
  { id: 'trx', symbol: 'TRX', name: 'TRON', network: 'TRON', networkGroup: 'tron', logo: '/crypto/trx.png' },
  { id: 'ton', symbol: 'TON', name: 'Toncoin', network: 'TON', networkGroup: 'ton', logo: '/crypto/ton.png' },
  { id: 'bnbbsc', symbol: 'BNB', name: 'BNB', network: 'BSC', networkGroup: 'bsc', logo: '/crypto/bnb.png' },
  { id: 'usdttrc20', symbol: 'USDT', name: 'Tether USD', network: 'TRON', networkGroup: 'tron', logo: '/crypto/usdt.png' },
  { id: 'usdterc20', symbol: 'USDT', name: 'Tether USD', network: 'Ethereum', networkGroup: 'ethereum', logo: '/crypto/usdt.png' },
  { id: 'usdc', symbol: 'USDC', name: 'USD Coin', network: 'Ethereum', networkGroup: 'ethereum', logo: '/crypto/usdc.png' },
  { id: 'usdtbsc', symbol: 'USDT', name: 'Tether USD', network: 'BSC', networkGroup: 'bsc', logo: '/crypto/usdt.png' },
  { id: 'pyusd', symbol: 'PYUSD', name: 'PayPal USD', network: 'Ethereum', networkGroup: 'ethereum', logo: '/crypto/pyusd.png' },
  { id: 'usdcbsc', symbol: 'USDC', name: 'USD Coin', network: 'BSC', networkGroup: 'bsc', logo: '/crypto/usdc.png' },
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

export function getCryptoPaymentOperationalMinimumUsd(currencyId: KobaraCryptoCurrencyId): number {
  const currency = getKobaraCryptoCurrency(currencyId);
  if (!currency) throw new Error('Devise crypto non supportée.');

  if (currency.networkGroup === 'ethereum') return 50;
  if (currency.networkGroup === 'bitcoin') return 25;
  if (currency.id === 'trx') return 10;
  return 20;
}

interface CryptoProviderError {
  code?: unknown;
  type?: unknown;
  httpStatus?: unknown;
  message?: unknown;
  details?: unknown;
}

export interface PublicCryptoCheckoutError {
  code: string;
  message: string;
  status: number;
}

export function getPublicCryptoCheckoutError(error: unknown): PublicCryptoCheckoutError {
  const providerError = error && typeof error === 'object' ? error as CryptoProviderError : null;
  const code = typeof providerError?.code === 'string' ? providerError.code : '';
  const message = typeof providerError?.message === 'string' ? providerError.message : '';
  const httpStatus = typeof providerError?.httpStatus === 'number' ? providerError.httpStatus : null;
  const details = providerError?.details && typeof providerError.details === 'object'
    ? providerError.details as Record<string, unknown>
    : {};
  const providerMessage = [details.message, details.error, message]
    .find((value) => typeof value === 'string' && value.trim()) as string | undefined;

  if (code === 'BELOW_MINIMUM_PAYMENT_AMOUNT') {
    const explicitMinimumUsd = Number(details.minimumUsd);
    const estimatedPayAmount = Number(details.estimatedPayAmount);
    const minimumPayAmount = Number(details.minimumPayAmount);
    const priceAmount = Number(details.priceAmount);
    const payCurrency = typeof details.payCurrency === 'string'
      ? details.payCurrency.toUpperCase()
      : 'cette devise';
    const minimumUsd = explicitMinimumUsd > 0
      ? explicitMinimumUsd
      : estimatedPayAmount > 0 && minimumPayAmount > 0 && priceAmount > 0
        ? Math.ceil(((priceAmount * minimumPayAmount) / estimatedPayAmount) * 100) / 100
        : null;

    return {
      code,
      message: minimumUsd
        ? `Le montant minimum pour ${payCurrency} est d’environ ${minimumUsd.toFixed(2)} USD.`
        : `Le montant est inférieur au minimum requis pour ${payCurrency}.`,
      status: 422,
    };
  }

  const configurationFailure = providerError?.type === 'configuration'
    || code === 'CRYPTO_NOT_CONFIGURED'
    || httpStatus === 401
    || httpStatus === 403
    || message.includes('NOWPAYMENTS_API_KEY')
    || message.includes('NOWPAYMENTS_IPN_SECRET');
  if (configurationFailure) {
    return {
      code: 'CRYPTO_NOT_CONFIGURED',
      message: 'Le paiement crypto est temporairement indisponible. La configuration du service doit être terminée.',
      status: 503,
    };
  }

  if (providerError?.type === 'network' || providerError?.type === 'timeout') {
    return {
      code: 'CRYPTO_PROVIDER_UNAVAILABLE',
      message: 'Le service crypto ne répond pas pour le moment. Réessayez dans quelques instants.',
      status: 503,
    };
  }

  if (code === 'API_REQUEST_FAILED') {
    const normalizedProviderMessage = providerMessage?.toLowerCase() || '';
    const unavailableCurrency = /currency|coin|network|not available|not supported|unsupported/.test(normalizedProviderMessage);
    return {
      code: unavailableCurrency ? 'CRYPTO_CURRENCY_UNAVAILABLE' : 'CRYPTO_PROVIDER_REJECTED',
      message: unavailableCurrency
        ? 'Cette crypto ou ce réseau est temporairement indisponible chez NOWPayments. Choisissez une autre option.'
        : 'NOWPayments a refusé l’initialisation de ce paiement. Choisissez une autre crypto ou réessayez dans quelques instants.',
      status: httpStatus && httpStatus >= 400 && httpStatus < 500 ? 422 : 502,
    };
  }

  return {
    code: code || 'CRYPTO_INITIALIZATION_FAILED',
    message: 'Le paiement crypto ne peut pas être initialisé pour le moment.',
    status: 502,
  };
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
