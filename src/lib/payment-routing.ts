export type PaymentWallet = 'moncash' | 'natcash';
export type PaymentMethodType = 'web' | 'ussd';
export type PaymentProcessor = 'paym' | 'bazik' | 'sms_gateway' | 'paypal';
export type ProviderPaymentMethod = 'moncash' | 'moncash_ussd' | 'natcash';

export interface PaymentRoutingConfig {
  active_provider: 'bazik' | 'paym';
  sms_gateway_enabled: boolean;
  paym_moncash_web: boolean;
  paym_moncash_ussd: boolean;
  paym_natcash_web: boolean;
  paym_natcash_ussd?: boolean;
}

export interface PaymentRoute {
  wallet: PaymentWallet;
  processor: PaymentProcessor;
  methodType: PaymentMethodType;
  providerMethod: ProviderPaymentMethod;
  requiresRedirect: boolean;
  requiresSmsConfirmation: boolean;
}

export interface ApiCheckoutDestinationInput {
  requestedProvider: PaymentWallet | 'carte' | 'card' | 'paypal' | 'kobara';
  environment: 'test' | 'live';
  paymentId: string;
  checkoutBaseUrl: string;
  processor?: PaymentProcessor | null;
  externalUrl?: string | null;
}

export class PaymentRoutingError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'PaymentRoutingError';
    this.code = code;
  }
}

export function normalizeHaitianPhoneNumber(phoneNumber?: string | null): string | null {
  const digits = (phoneNumber || '').replace(/\D/g, '');
  const normalized = digits.length === 8 ? `509${digits}` : digits;
  return /^509\d{8}$/.test(normalized) ? normalized : null;
}

export function isValidPaymReference(reference: string): boolean {
  return /^[A-Za-z0-9]{1,20}$/.test(reference);
}

export function createPaymReference(prefix = 'KOB'): string {
  const safePrefix = prefix.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'KOB';
  const timestamp = Date.now().toString(36).toUpperCase();
  const remaining = Math.max(1, 20 - safePrefix.length - timestamp.length);
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let random = '';
  for (let i = 0; i < remaining; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${safePrefix}${timestamp}${random}`.slice(0, 20);
}

export function normalizePaymAmount(wallet: PaymentWallet, amount: number): number {
  return wallet === 'natcash' ? Math.ceil(amount) : amount;
}

export function sanitizePaymentRedirectUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  let trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  } else if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    trimmed = `https://${trimmed}`;
  }

  try {
    if (trimmed.startsWith('/')) {
      return trimmed;
    }
    const url = new URL(trimmed);
    if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      url.protocol = 'https:';
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function resolveApiCheckoutUrl(input: ApiCheckoutDestinationInput): string {
  const baseUrl = input.checkoutBaseUrl.replace(/\/$/, '');

  if (input.requestedProvider === 'carte' || input.requestedProvider === 'card' || input.requestedProvider === 'paypal') {
    return input.externalUrl || `${baseUrl}/checkout/${input.paymentId}`;
  }

  if (input.environment === 'test' || input.requestedProvider === 'kobara') {
    return `${baseUrl}/checkout/${input.paymentId}`;
  }

  if (input.processor === 'sms_gateway') {
    return `${baseUrl}/checkout/${input.paymentId}/natcash`;
  }

  if (input.externalUrl) {
    return input.externalUrl;
  }

  // Fallback to unified checkout page so user can enter their phone and complete payment
  return `${baseUrl}/checkout/${input.paymentId}`;
}

export function normalizePaymentRoutingConfig<T extends PaymentRoutingConfig>(
  config: T
): T {
  return {
    ...config,
    sms_gateway_enabled:
      config.active_provider === 'bazik' && config.sms_gateway_enabled === true,
    // Pay'm v1.6 documents NatCash redirect, but not NatCash USSD.
    paym_natcash_ussd: false,
  };
}

export function resolvePaymentRoute(
  rawConfig: PaymentRoutingConfig,
  input: {
    wallet: PaymentWallet;
    requestedMethod?: PaymentMethodType;
    phoneNumber?: string | null;
  }
): PaymentRoute {
  const config = normalizePaymentRoutingConfig(rawConfig);
  const requestedMethod = input.requestedMethod || 'web';

  if (config.active_provider === 'bazik') {
    if (input.wallet === 'moncash') {
      if (requestedMethod === 'ussd') {
        throw new PaymentRoutingError(
          'BAZIK_USSD_UNSUPPORTED',
          "Cette configuration prend uniquement en charge le paiement MonCash par redirection."
        );
      }

      return {
        wallet: 'moncash',
        processor: 'bazik',
        methodType: 'web',
        providerMethod: 'moncash',
        requiresRedirect: true,
        requiresSmsConfirmation: false,
      };
    }

    if (!config.sms_gateway_enabled) {
      throw new PaymentRoutingError(
        'SMS_GATEWAY_DISABLED',
        "Le paiement NatCash est temporairement indisponible."
      );
    }

    return {
      wallet: 'natcash',
      processor: 'sms_gateway',
      methodType: 'web',
      providerMethod: 'natcash',
      requiresRedirect: false,
      requiresSmsConfirmation: true,
    };
  }

  if (input.wallet === 'natcash') {
    if (requestedMethod === 'ussd') {
      throw new PaymentRoutingError(
        'PAYM_NATCASH_USSD_UNSUPPORTED',
        "NatCash USSD n'est pas disponible. Utilisez NatCash Web."
      );
    }

    if (!config.paym_natcash_web) {
      throw new PaymentRoutingError(
        'PAYM_NATCASH_DISABLED',
        "Le paiement NatCash est temporairement désactivé."
      );
    }

    return {
      wallet: 'natcash',
      processor: 'paym',
      methodType: 'web',
      providerMethod: 'natcash',
      requiresRedirect: true,
      requiresSmsConfirmation: false,
    };
  }

  if (requestedMethod === 'ussd') {
    if (!config.paym_moncash_ussd) {
      throw new PaymentRoutingError(
        'PAYM_MONCASH_USSD_DISABLED',
        "Le paiement MonCash USSD est temporairement désactivé."
      );
    }

    if (!normalizeHaitianPhoneNumber(input.phoneNumber)) {
      throw new PaymentRoutingError(
        'PHONE_REQUIRED',
        'Un numéro MonCash haïtien valide est obligatoire pour un paiement USSD.'
      );
    }

    return {
      wallet: 'moncash',
      processor: 'paym',
      methodType: 'ussd',
      providerMethod: 'moncash_ussd',
      requiresRedirect: false,
      requiresSmsConfirmation: false,
    };
  }

  if (config.paym_moncash_web) {
    return {
      wallet: 'moncash',
      processor: 'paym',
      methodType: 'web',
      providerMethod: 'moncash',
      requiresRedirect: true,
      requiresSmsConfirmation: false,
    };
  }

  if (config.paym_moncash_ussd && normalizeHaitianPhoneNumber(input.phoneNumber)) {
    return {
      wallet: 'moncash',
      processor: 'paym',
      methodType: 'ussd',
      providerMethod: 'moncash_ussd',
      requiresRedirect: false,
      requiresSmsConfirmation: false,
    };
  }

  throw new PaymentRoutingError(
    'PAYM_MONCASH_DISABLED',
    "Le paiement MonCash est temporairement désactivé."
  );
}

export function getRecordedPaymentProcessor(payment: {
  provider?: string | null;
  payment_method?: string | null;
  reference_code?: string | null;
  metadata?: Record<string, unknown> | null;
}): PaymentProcessor | null {
  const recorded = payment.metadata?.payment_processor;
  if (recorded === 'paym' || recorded === 'bazik' || recorded === 'sms_gateway' || recorded === 'paypal') {
    return recorded;
  }

  if (payment.provider === 'paypal' || payment.metadata?.provider === 'paypal') {
    return 'paypal';
  }

  if (payment.provider === 'paym' || payment.metadata?.provider === 'paym') {
    return 'paym';
  }

  if (payment.payment_method?.endsWith('_ussd')) {
    return 'paym';
  }

  if (
    (payment.provider === 'natcash' || payment.provider === 'kobara') &&
    payment.reference_code
  ) {
    return 'sms_gateway';
  }

  if (payment.provider === 'moncash') {
    return 'bazik';
  }

  return null;
}

export function withPaymentRoutingMetadata(
  metadata: Record<string, unknown> | null | undefined,
  route: PaymentRoute,
  transactionId?: string | null
) {
  return {
    ...(metadata || {}),
    payment_processor: route.processor,
    wallet_provider: route.wallet,
    provider_payment_method: route.providerMethod,
    ...(transactionId ? { provider_transaction_id: transactionId } : {}),
  };
}
