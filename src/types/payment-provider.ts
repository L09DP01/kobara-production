export interface PaymentProviderConfig {
  active_provider: 'bazik' | 'paym';
  sms_gateway_enabled: boolean;
  paym_moncash_web: boolean;
  paym_moncash_ussd: boolean;
  paym_natcash_web: boolean;
  paym_natcash_ussd: boolean;
  paypal_global_enabled: boolean;
  paypal_htg_per_usd: number;
  paypal_fee_percent: number;
  paypal_fee_fixed_usd: number;
}

export const DEFAULT_PROVIDER_CONFIG: PaymentProviderConfig = {
  active_provider: 'bazik',
  sms_gateway_enabled: true,
  paym_moncash_web: true,
  paym_moncash_ussd: true,
  paym_natcash_web: true,
  paym_natcash_ussd: false,
  paypal_global_enabled: false,
  paypal_htg_per_usd: 130,
  paypal_fee_percent: 3.5,
  paypal_fee_fixed_usd: 0.70,
};
