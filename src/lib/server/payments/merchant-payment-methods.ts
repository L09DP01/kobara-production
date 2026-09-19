import { createAdminClient } from '@/utils/supabase/admin';
import { isNowPaymentsConfigured } from '@/lib/server/payments/nowpayments';

export const MERCHANT_PAYMENT_METHODS = [
  'moncash',
  'natcash',
  'card',
  'paypal',
  'apple_pay',
  'google_pay',
  'crypto',
] as const;

export type MerchantPaymentMethod = (typeof MERCHANT_PAYMENT_METHODS)[number];
export type MerchantPaymentMethodMap = Record<MerchantPaymentMethod, boolean>;

export const DEFAULT_MERCHANT_PAYMENT_METHODS: MerchantPaymentMethodMap = {
  moncash: true,
  natcash: true,
  card: false,
  paypal: false,
  apple_pay: false,
  google_pay: false,
  crypto: false,
};

export interface MerchantPaymentMethodState {
  configured: MerchantPaymentMethodMap;
  eligible: MerchantPaymentMethodMap;
  enabled: MerchantPaymentMethodMap;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeMerchantPaymentMethods(settingsJson: unknown): MerchantPaymentMethodMap {
  const root = isRecord(settingsJson) ? settingsJson : {};
  const stored = isRecord(root.payment_methods) ? root.payment_methods : {};

  return MERCHANT_PAYMENT_METHODS.reduce((result, method) => {
    result[method] = typeof stored[method] === 'boolean'
      ? stored[method] as boolean
      : DEFAULT_MERCHANT_PAYMENT_METHODS[method];
    return result;
  }, { ...DEFAULT_MERCHANT_PAYMENT_METHODS });
}

export function paymentMethodForProvider(provider: string): MerchantPaymentMethod | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized.startsWith('moncash')) return 'moncash';
  if (normalized.startsWith('natcash')) return 'natcash';
  if (normalized === 'carte' || normalized === 'card') return 'card';
  if (normalized === 'paypal') return 'paypal';
  if (normalized === 'apple_pay') return 'apple_pay';
  if (normalized === 'google_pay') return 'google_pay';
  if (normalized === 'crypto') return 'crypto';
  return null;
}

export async function getMerchantPaymentMethodState(merchantId: string): Promise<MerchantPaymentMethodState> {
  const admin = createAdminClient();
  const [{ data: settings }, { data: merchant }] = await Promise.all([
    admin.from('settings').select('settings_json').eq('merchant_id', merchantId).maybeSingle(),
    admin.from('merchants').select('paypal_enabled, has_usd_account').eq('id', merchantId).maybeSingle(),
  ]);

  const configured = normalizeMerchantPaymentMethods(settings?.settings_json);
  const internationalEligible = merchant?.paypal_enabled === true && merchant?.has_usd_account === true;
  const eligible: MerchantPaymentMethodMap = {
    moncash: true,
    natcash: true,
    card: internationalEligible,
    paypal: internationalEligible,
    apple_pay: internationalEligible,
    google_pay: internationalEligible,
    crypto: merchant?.has_usd_account === true && isNowPaymentsConfigured(),
  };
  const enabled = MERCHANT_PAYMENT_METHODS.reduce((result, method) => {
    result[method] = configured[method] && eligible[method];
    return result;
  }, { ...DEFAULT_MERCHANT_PAYMENT_METHODS });

  return { configured, eligible, enabled };
}

export async function isMerchantPaymentMethodEnabled(merchantId: string, provider: string) {
  const state = await getMerchantPaymentMethodState(merchantId);
  if (provider.trim().toLowerCase() === 'kobara') {
    return Object.values(state.enabled).some(Boolean);
  }
  const method = paymentMethodForProvider(provider);
  return method ? state.enabled[method] : false;
}

