export const LOCAL_PAYMENT_FEE_PERCENT = 3.9;
export const DASHBOARD_DAILY_WITHDRAWAL_LIMIT_HTG = 50_000;
export const WITHDRAWAL_TRANSACTION_LIMIT_HTG = 75_000;

export function isWithdrawalAmountAllowed(amount: number, currency: 'HTG' | 'USD', exchangeRate: number): boolean {
  const htg = currency === 'USD' ? amount * exchangeRate : amount;
  return Number.isFinite(htg) && amount > 0 && Number.isFinite(exchangeRate) && exchangeRate > 0 && htg <= WITHDRAWAL_TRANSACTION_LIMIT_HTG;
}

export const MERCHANT_ACCESS = {
  subscriptionPlan: null,
  effectivePlan: 'free',
  status: 'active',
  currentPeriodEnd: null,
  gracePeriodEnd: null,
  isActive: true,
  isExpired: false,
  isGracePeriod: false,
  canUsePaidFeatures: true,
  daysUntilExpiration: null,
  reason: 'free' as const,
};
