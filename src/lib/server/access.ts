import 'server-only';

import { activateFreePlanAfterKyc, getMerchantSubscriptionEntitlement, SubscriptionRequiredError } from './plans';
import { getApiKeysCount, getDailyWithdrawalTotal, getMonthlyPaymentCount } from './usage';

export type AccessDenialReason =
  | 'kyc_required'
  | 'subscription_expired'
  | 'plan_required'
  | 'payment_limit_reached'
  | 'api_key_limit_reached'
  | 'withdrawal_limit_reached';

export type AccessCheck = { allowed: true } | { allowed: false; reason: AccessDenialReason };

export async function getMerchantAccess(merchantId: string) {
  return getMerchantSubscriptionEntitlement(merchantId);
}

export async function ensureCanUseLiveMode(merchantId: string, environment: 'test' | 'live') {
  let access = await getMerchantAccess(merchantId);
  if (environment !== 'live') return access;

  if (access.merchant.kyc_status !== 'approved') throw new Error('kyc_required');

  if (!access.subscription) {
    await activateFreePlanAfterKyc(merchantId);
    access = await getMerchantAccess(merchantId);
  }

  if (!access.plan) throw new Error('plan_required');
  return access;
}

function expiredLimitReason(access: Awaited<ReturnType<typeof getMerchantAccess>>, fallback: AccessDenialReason) {
  return access.entitlement.subscriptionPlan !== null
    && access.entitlement.subscriptionPlan !== 'free'
    && !access.entitlement.canUsePaidFeatures
    ? 'subscription_expired'
    : fallback;
}

export async function requirePlan(merchantId: string, requiredPlan: 'pro' | 'premium' | 'business') {
  const access = await getMerchantAccess(merchantId);
  const ranks = { free: 0, pro: 1, premium: 2, business: 3 } as const;
  const effectiveRank = ranks[access.entitlement.effectivePlan as keyof typeof ranks] ?? 0;
  if (!access.entitlement.canUsePaidFeatures || effectiveRank < ranks[requiredPlan]) {
    throw new SubscriptionRequiredError();
  }
  return access;
}

export async function canCreatePayment(merchantId: string, environment: 'test' | 'live'): Promise<AccessCheck> {
  try {
    const access = await ensureCanUseLiveMode(merchantId, environment);
    if (environment === 'live' && access.plan?.monthly_payment_limit !== null) {
      const currentCount = await getMonthlyPaymentCount(merchantId);
      if (currentCount >= Number(access.plan?.monthly_payment_limit ?? 0)) {
        return { allowed: false, reason: expiredLimitReason(access, 'payment_limit_reached') };
      }
    }
    return { allowed: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason === 'kyc_required' || reason === 'plan_required') return { allowed: false, reason };
    throw error;
  }
}

export async function canCreateApiKey(merchantId: string, environment: 'test' | 'live'): Promise<AccessCheck> {
  try {
    const access = await ensureCanUseLiveMode(merchantId, environment);
    // NULL is the explicit "unlimited" value for Business plans. Only fall
    // back to one key when no effective plan could be resolved at all.
    const limit = access.plan ? access.plan.api_keys_limit : 1;
    if (limit !== null) {
      const currentCount = await getApiKeysCount(merchantId, environment);
      if (currentCount >= Number(limit)) {
        return { allowed: false, reason: expiredLimitReason(access, 'api_key_limit_reached') };
      }
    }
    return { allowed: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason === 'kyc_required' || reason === 'plan_required') return { allowed: false, reason };
    throw error;
  }
}

export async function canCreateWithdrawal(merchantId: string, amount: number): Promise<AccessCheck> {
  try {
    const access = await ensureCanUseLiveMode(merchantId, 'live');
    if (access.plan?.daily_withdrawal_limit !== null) {
      const currentDailyTotal = await getDailyWithdrawalTotal(merchantId);
      if (currentDailyTotal + amount > Number(access.plan?.daily_withdrawal_limit ?? 0)) {
        return { allowed: false, reason: expiredLimitReason(access, 'withdrawal_limit_reached') };
      }
    }
    return { allowed: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason === 'kyc_required' || reason === 'plan_required') return { allowed: false, reason };
    throw error;
  }
}
