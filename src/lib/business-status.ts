export function businessEnvironmentLabel(merchant: { shopify_review_mode?: boolean; kyc_status?: string; current_environment?: string }) {
  if (merchant.shopify_review_mode) return 'Test';
  return merchant.kyc_status === 'approved' && merchant.current_environment === 'live' ? 'Production' : 'En validation';
}
