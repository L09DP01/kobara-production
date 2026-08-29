export type SubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_htg: number;
  monthly_payment_limit: number | null;
  api_keys_limit: number | null;
  transaction_fee_percent: number;
  daily_withdrawal_limit: number | null;
  wordpress_plugin: boolean;
  webhooks_level: string;
  analytics_level: string;
  support_level: string;
  is_contact_sales: boolean;
  features: unknown;
  limits: unknown;
  status: string;
  sort_order: number;
};

export type SubscriptionRecord = {
  id: string;
  merchant_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  amount_htg: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_period_end?: string | null;
  payment_status?: string | null;
  payment_id?: string | null;
  activation_source?: string | null;
  auto_renew?: boolean;
  created_at?: string | null;
  plan?: SubscriptionPlan | null;
};

export type SubscriptionEntitlement = {
  subscriptionPlan: string | null;
  effectivePlan: string;
  status: string;
  currentPeriodEnd: string | null;
  gracePeriodEnd: string | null;
  isActive: boolean;
  isExpired: boolean;
  isGracePeriod: boolean;
  canUsePaidFeatures: boolean;
  daysUntilExpiration: number | null;
  reason: 'active' | 'grace_period' | 'free' | 'expired' | 'invalid_period' | 'payment_unconfirmed' | 'inactive' | 'none';
};

const PAID_ACTIVE_STATUS = 'active';

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function evaluateSubscriptionEntitlement(
  subscription: SubscriptionRecord | null | undefined,
  now: Date = new Date(),
): SubscriptionEntitlement {
  if (!subscription) {
    return {
      subscriptionPlan: null,
      effectivePlan: 'free',
      status: 'none',
      currentPeriodEnd: null,
      gracePeriodEnd: null,
      isActive: false,
      isExpired: false,
      isGracePeriod: false,
      canUsePaidFeatures: false,
      daysUntilExpiration: null,
      reason: 'none',
    };
  }

  const planSlug = subscription.plan?.slug ?? null;
  const isFreePlan = planSlug === 'free' || Number(subscription.plan?.price_htg ?? subscription.amount_htg) === 0;
  const periodEndTime = parseTime(subscription.current_period_end);
  const graceEndTime = parseTime(subscription.grace_period_end);
  const nowTime = now.getTime();
  const paymentStatus = subscription.payment_status;
  const paymentIsConfirmed = paymentStatus === undefined
    || paymentStatus === 'paid'
    || paymentStatus === 'legacy_confirmed'
    || (paymentStatus === 'not_required' && ['promo', 'admin'].includes(subscription.activation_source ?? ''));
  const statusIsActive = subscription.status === PAID_ACTIVE_STATUS;

  if (isFreePlan) {
    return {
      subscriptionPlan: planSlug ?? 'free',
      effectivePlan: 'free',
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      gracePeriodEnd: subscription.grace_period_end ?? null,
      isActive: statusIsActive,
      isExpired: false,
      isGracePeriod: false,
      canUsePaidFeatures: false,
      daysUntilExpiration: null,
      reason: 'free',
    };
  }

  const periodIsActive = statusIsActive && paymentIsConfirmed && periodEndTime !== null && periodEndTime > nowTime;
  const graceIsActive = statusIsActive && paymentIsConfirmed && !periodIsActive && graceEndTime !== null && graceEndTime > nowTime;
  const daysUntilExpiration = periodEndTime === null
    ? null
    : Math.max(0, Math.ceil((periodEndTime - nowTime) / 86_400_000));

  if (periodIsActive || graceIsActive) {
    return {
      subscriptionPlan: planSlug,
      effectivePlan: planSlug ?? 'free',
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      gracePeriodEnd: subscription.grace_period_end ?? null,
      isActive: true,
      isExpired: false,
      isGracePeriod: graceIsActive,
      canUsePaidFeatures: true,
      daysUntilExpiration,
      reason: graceIsActive ? 'grace_period' : 'active',
    };
  }

  const periodIsExpired = periodEndTime !== null && periodEndTime <= nowTime;
  return {
    subscriptionPlan: planSlug,
    effectivePlan: 'free',
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    gracePeriodEnd: subscription.grace_period_end ?? null,
    isActive: false,
    isExpired: periodIsExpired,
    isGracePeriod: false,
    canUsePaidFeatures: false,
    daysUntilExpiration,
    reason: !paymentIsConfirmed
      ? 'payment_unconfirmed'
      : periodEndTime === null
      ? 'invalid_period'
      : periodIsExpired
        ? 'expired'
        : 'inactive',
  };
}

export function pickSubscriptionForEntitlement(
  subscriptions: SubscriptionRecord[],
  now: Date = new Date(),
): SubscriptionRecord | null {
  if (subscriptions.length === 0) return null;

  const paidEntitled = subscriptions.find((subscription) =>
    evaluateSubscriptionEntitlement(subscription, now).canUsePaidFeatures,
  );
  if (paidEntitled) return paidEntitled;

  const latestPaid = subscriptions.find((subscription) => subscription.plan?.slug !== 'free');
  if (latestPaid) return latestPaid;

  return subscriptions[0];
}
