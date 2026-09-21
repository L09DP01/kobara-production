export type DeveloperTier = 'developer' | 'partner' | 'pro_partner' | 'agency';

export const DEVELOPER_INTEGRATION_LIMITS = {
  HTG: 7_000,
  USD: 55,
} as const;

export const MERCHANT_REFERRAL_THRESHOLDS = {
  HTG: 10_000,
  USD: 50,
} as const;

export const MERCHANT_REFERRER_MINIMUM_HTG = 1_500;

export function getDeveloperTier(activeMerchantCount: number): DeveloperTier {
  if (activeMerchantCount >= 50) return 'agency';
  if (activeMerchantCount >= 20) return 'pro_partner';
  if (activeMerchantCount >= 5) return 'partner';
  return 'developer';
}

export function getDeveloperCommissionRate(
  tier: DeveloperTier,
  agencyOverride?: number | null,
): number | null {
  if (tier === 'developer') return 10;
  if (tier === 'partner') return 30;
  if (tier === 'pro_partner') return 50;
  return agencyOverride === null || agencyOverride === undefined
    ? null
    : Math.min(100, Math.max(0, agencyOverride));
}

export function calculateDeveloperCommission(
  grossAmount: number,
  commissionRatePercent: number,
): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0;
  if (!Number.isFinite(commissionRatePercent) || commissionRatePercent <= 0) return 0;

  const kobaraRevenue = grossAmount * 0.01;
  return Math.round(kobaraRevenue * (commissionRatePercent / 100) * 100) / 100;
}

export function isMerchantReferralQualified(input: {
  hasActiveProPlan: boolean;
  htgTotal: number;
  usdTotal: number;
}): boolean {
  if (!input.hasActiveProPlan) return false;
  return input.htgTotal >= MERCHANT_REFERRAL_THRESHOLDS.HTG
    || input.usdTotal >= MERCHANT_REFERRAL_THRESHOLDS.USD;
}

export function canCreditMerchantReferralReward(input: {
  invitedMerchantQualified: boolean;
  referrerHtgTotal: number;
}): boolean {
  return input.invitedMerchantQualified
    && Number.isFinite(input.referrerHtgTotal)
    && input.referrerHtgTotal >= MERCHANT_REFERRER_MINIMUM_HTG;
}
