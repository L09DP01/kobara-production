import 'server-only';
import { isReviewAccount } from '@/lib/review-account';
import { getMerchantSubscriptionEntitlement } from './plans';
import { getDailyWithdrawalTotal } from './usage';
import { DASHBOARD_DAILY_WITHDRAWAL_LIMIT_HTG } from '@/lib/merchant-pricing';

export type AccessDenialReason = 'review_account_restricted' | 'kyc_required' | 'subscription_expired' | 'plan_required' | 'payment_limit_reached' | 'api_key_limit_reached' | 'withdrawal_limit_reached';
export type AccessCheck = { allowed: true } | { allowed: false; reason: AccessDenialReason; limit?: number; used?: number; requested?: number; remaining?: number };
export async function getMerchantAccess(merchantId: string) { return getMerchantSubscriptionEntitlement(merchantId); }
export async function ensureCanUseLiveMode(merchantId: string, environment: 'test' | 'live') {
  const access = await getMerchantAccess(merchantId);
  if (environment === 'live' && access.merchant.kyc_status !== 'approved') throw new Error('kyc_required');
  return access;
}
export async function requirePlan(merchantId: string, _requiredPlan: 'pro' | 'premium' | 'business') {
  return ensureCanUseLiveMode(merchantId, 'live');
}
export async function canCreatePayment(merchantId: string, environment: 'test' | 'live'): Promise<AccessCheck> {
  try { const access = await ensureCanUseLiveMode(merchantId, environment); if (isReviewAccount(access.merchant)) return { allowed: false, reason: 'review_account_restricted' }; return { allowed: true }; }
  catch (error) { if (error instanceof Error && error.message === 'kyc_required') return { allowed: false, reason: 'kyc_required' }; throw error; }
}
export const canCreateApiKey = canCreatePayment;
export async function canCreateWithdrawal(merchantId: string, amount: number, source: 'dashboard' | 'api' = 'api'): Promise<AccessCheck> {
  const access = await canCreatePayment(merchantId, 'live');
  if (!access.allowed || source !== 'dashboard') return access;
  const used = await getDailyWithdrawalTotal(merchantId);
  const limit = DASHBOARD_DAILY_WITHDRAWAL_LIMIT_HTG;
  return used + amount > limit ? { allowed: false, reason: 'withdrawal_limit_reached', limit, used, requested: amount, remaining: Math.max(0, limit - used) } : { allowed: true };
}
