import 'server-only';

import { randomUUID } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  evaluateSubscriptionEntitlement,
  pickSubscriptionForEntitlement,
  type SubscriptionEntitlement,
  type SubscriptionPlan,
  type SubscriptionRecord,
} from '@/lib/server/subscription-entitlement';
import {
  dispatchPendingSubscriptionExpirationEmails,
  notifySubscriptionExpired,
  notifySubscriptionGracePeriod,
  notifySubscriptionPlanChanged,
  notifySubscriptionRenewed,
  notifySubscriptionWarning,
} from '@/lib/server/notifications';

export type Plan = SubscriptionPlan;
export type Subscription = SubscriptionRecord;

export type SubscriptionActivation = {
  billingCycle?: 'monthly' | 'yearly';
  amountHTG: number;
  paymentStatus: 'paid' | 'not_required';
  source: 'free' | 'promo' | 'balance' | 'provider' | 'admin';
  paymentId?: string | null;
  paymentLabel?: string;
  promoCodeId?: string | null;
};

export class SubscriptionRequiredError extends Error {
  code = 'SUBSCRIPTION_EXPIRED' as const;

  constructor(message = 'Cette fonctionnalité nécessite un abonnement actif.') {
    super(message);
    this.name = 'SubscriptionRequiredError';
  }
}

export async function getPlans(): Promise<Plan[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Erreur récupération plans:', error);
    return [];
  }
  return data as Plan[];
}

export async function getPlanBySlug(slug: string): Promise<Plan | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('plans').select('*').eq('slug', slug).single();
  if (error) return null;
  return data as Plan;
}

export async function getMerchantSubscriptionEntitlement(merchantId: string) {
  const supabase = createAdminClient();
  const [{ data: merchant, error: merchantError }, { data: subscriptions, error: subscriptionError }, freePlan] = await Promise.all([
    supabase
      .from('merchants')
      .select('id, email, plan_slug, plan_status, account_access, kyc_status, available_balance')
      .eq('id', merchantId)
      .single(),
    supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false }),
    getPlanBySlug('free'),
  ]);

  if (merchantError || !merchant) throw new Error('Marchand introuvable');
  if (subscriptionError) throw new Error(`Impossible de vérifier l'abonnement: ${subscriptionError.message}`);

  const records = (subscriptions ?? []) as SubscriptionRecord[];
  const selectedSubscription = pickSubscriptionForEntitlement(records);
  const entitlement = evaluateSubscriptionEntitlement(selectedSubscription);
  const isTestOnly = merchant.plan_slug === 'test_only' && !selectedSubscription;
  const effectivePlan = isTestOnly
    ? null
    : entitlement.canUsePaidFeatures
      ? selectedSubscription?.plan ?? freePlan
      : freePlan;

  if (!effectivePlan && merchant.plan_slug !== 'test_only') {
    throw new Error('Plan gratuit introuvable');
  }

  return {
    merchant: {
      ...merchant,
      plan_slug: isTestOnly ? 'test_only' : entitlement.effectivePlan,
      plan_status: isTestOnly
        ? merchant.plan_status
        : entitlement.canUsePaidFeatures || entitlement.reason === 'free' || entitlement.reason === 'none'
          ? 'active'
          : 'expired',
    },
    plan: effectivePlan ?? null,
    subscription: selectedSubscription,
    entitlement,
  };
}

export async function getMerchantCurrentPlan(merchantId: string) {
  return getMerchantSubscriptionEntitlement(merchantId);
}

export async function requireActiveSubscription(merchantId: string): Promise<SubscriptionEntitlement> {
  const { entitlement } = await getMerchantSubscriptionEntitlement(merchantId);
  if (!entitlement.canUsePaidFeatures) throw new SubscriptionRequiredError();
  return entitlement;
}

export async function activateFreePlanAfterKyc(merchantId: string) {
  const supabase = createAdminClient();
  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('kyc_status')
    .eq('id', merchantId)
    .single();

  if (error || !merchant) throw new Error('Marchand introuvable');
  if (merchant.kyc_status !== 'approved') throw new Error('Le KYC doit être approuvé pour activer le mode Live.');

  await upgradeMerchantPlan(merchantId, 'free', {
    amountHTG: 0,
    paymentStatus: 'not_required',
    source: 'free',
    billingCycle: 'monthly',
  });

  return { success: true };
}

export async function upgradeMerchantPlan(
  merchantId: string,
  planSlug: string,
  activation: SubscriptionActivation,
) {
  const supabase = createAdminClient();
  const plan = await getPlanBySlug(planSlug);
  if (!plan) throw new Error('Plan introuvable');
  const { data: merchantBefore } = await supabase
    .from('merchants')
    .select('email, plan_slug')
    .eq('id', merchantId)
    .single();

  const isFree = plan.slug === 'free' || Number(plan.price_htg) === 0;
  const isCoveredByPromo = activation.source === 'promo' && activation.paymentStatus === 'not_required';
  if (!isFree && activation.paymentStatus !== 'paid' && !isCoveredByPromo) {
    throw new Error('Le paiement doit être confirmé avant l’activation du plan.');
  }
  if (!isFree && activation.source === 'free') {
    throw new Error('Un plan payant ne peut pas être activé gratuitement.');
  }

  const billingCycle = activation.billingCycle === 'yearly' ? 'yearly' : 'monthly';
  const rpcName = activation.promoCodeId
    ? 'activate_merchant_subscription_with_promo'
    : 'activate_merchant_subscription';
  const rpcParams = {
    p_merchant_id: merchantId,
    p_plan_id: plan.id,
    p_billing_cycle: billingCycle,
    p_amount_htg: activation.amountHTG,
    p_payment_status: activation.paymentStatus,
    p_payment_id: activation.paymentId ?? null,
    p_activation_source: activation.source,
    ...(activation.promoCodeId ? { p_promo_code_id: activation.promoCodeId } : {}),
  };
  const { data: subscriptionId, error } = await supabase.rpc(rpcName, rpcParams);

  if (error) throw new Error(`Erreur activation abonnement: ${error.message}`);

  try {
    await notifyMerchantPlanTransition({
      merchantId,
      email: merchantBefore?.email || '',
      previousPlanSlug: merchantBefore?.plan_slug || null,
      newPlan: plan,
      source: activation.source,
      paymentLabel: activation.paymentLabel,
      resourceId: String(subscriptionId),
    });
  } catch (notificationError) {
    console.error('Subscription plan notification failed:', notificationError);
  }
  return { success: true, subscriptionId };
}

export async function notifyMerchantPlanTransition(input: {
  merchantId: string;
  email?: string | null;
  previousPlanSlug?: string | null;
  newPlan: Pick<Plan, 'slug' | 'name' | 'price_htg'>;
  source: SubscriptionActivation['source'];
  paymentLabel?: string;
  resourceId?: string;
}) {
  const previousPlan = input.previousPlanSlug
    ? await getPlanBySlug(input.previousPlanSlug)
    : null;
  const previousPrice = Number(previousPlan?.price_htg || 0);
  const newPrice = Number(input.newPlan.price_htg || 0);
  const samePlan = previousPlan?.slug === input.newPlan.slug;

  const change: 'activated' | 'renewed' | 'upgraded' | 'downgraded' = samePlan
    ? 'renewed'
    : input.newPlan.slug === 'free' || newPrice < previousPrice
      ? previousPlan ? 'downgraded' : 'activated'
      : previousPlan && previousPlan.slug !== 'free'
        ? 'upgraded'
        : 'activated';

  const paymentLabel = input.paymentLabel || {
    balance: 'solde Kobara',
    provider: 'paiement mobile',
    promo: 'code promo',
    free: 'activation gratuite',
    admin: 'administration Kobara',
  }[input.source];

  await notifySubscriptionPlanChanged(
    input.merchantId,
    input.email || '',
    previousPlan?.name || input.previousPlanSlug || null,
    input.newPlan.name,
    change,
    paymentLabel,
    input.resourceId,
  );
}

export async function cancelSubscription(merchantId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
    .eq('merchant_id', merchantId)
    .eq('status', 'active');
  if (error) throw new Error(`Erreur annulation abonnement: ${error.message}`);

  await supabase.from('audit_logs').insert({ merchant_id: merchantId, action: 'plan.cancel_scheduled' });
  return { success: true };
}

export async function syncSubscriptionLifecycle(targetMerchantId?: string) {
  const supabase = createAdminClient();
  let query = supabase
    .from('subscriptions')
    .select('*, plan:plans(*)')
    .eq('status', 'active');
  if (targetMerchantId) query = query.eq('merchant_id', targetMerchantId);

  const { data, error } = await query;
  if (error) throw new Error(`Subscription lifecycle query failed: ${error.message}`);

  const now = new Date();
  let processed = 0;

  for (const subscription of (data ?? []) as SubscriptionRecord[]) {
    const plan = subscription.plan;
    if (!plan || plan.slug === 'free' || Number(plan.price_htg) === 0) continue;

    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
    const entitlement = evaluateSubscriptionEntitlement(subscription, now);
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, email, available_balance')
      .eq('id', subscription.merchant_id)
      .maybeSingle();
    if (!merchant) continue;

    if (entitlement.canUsePaidFeatures && !entitlement.isGracePeriod && entitlement.daysUntilExpiration !== null) {
      if ([7, 3, 1].includes(entitlement.daysUntilExpiration)) {
        await notifySubscriptionWarning(
          merchant.id,
          merchant.email,
          entitlement.daysUntilExpiration,
          `subscription_warning_${subscription.id}_${entitlement.daysUntilExpiration}_${subscription.current_period_end}`,
        );
        processed++;
      }
      continue;
    }

    if (entitlement.isGracePeriod) {
      const graceEnd = new Date(subscription.grace_period_end!);
      const daysGrace = Math.max(1, Math.ceil((graceEnd.getTime() - now.getTime()) / 86_400_000));
      await notifySubscriptionGracePeriod(
        merchant.id,
        merchant.email,
        daysGrace,
        `subscription_grace_${subscription.id}_${subscription.grace_period_end}`,
      );
      continue;
    }

    const expired = !periodEnd || periodEnd <= now;
    if (!expired) continue;

    if (subscription.auto_renew && Number(subscription.amount_htg) > 0) {
      const { data: renewed, error: renewalError } = await supabase.rpc('renew_subscription_from_balance', {
        p_subscription_id: subscription.id,
      });
      if (renewalError) console.error('Automatic subscription renewal failed:', renewalError);
      if (renewed) {
        const nextEnd = subscription.billing_cycle === 'yearly'
          ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
          : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        await notifySubscriptionRenewed(
          merchant.id,
          merchant.email,
          plan.name,
          Number(subscription.amount_htg),
          `subscription_renewed_${subscription.id}_${nextEnd.toISOString()}`,
        );
        processed++;
        continue;
      }
    }

    const { error: expireError } = await supabase.rpc('expire_merchant_subscription', {
      p_subscription_id: subscription.id,
    });
    if (expireError) throw new Error(`Subscription expiration failed: ${expireError.message}`);

    const expirationResourceId = `subscription_expired_${subscription.id}_${subscription.current_period_end ?? 'invalid'}`;
    const notificationResult = await notifySubscriptionExpired(
      merchant.id,
      merchant.email,
      plan.name,
      subscription.current_period_end,
      expirationResourceId,
    );
    await supabase.from('audit_logs').insert({
      merchant_id: merchant.id,
      action: 'plan.auto_downgraded_free',
      entity_type: 'subscriptions',
      entity_id: subscription.id,
      metadata: {
        previous_plan: plan.slug,
        subscription_id: subscription.id,
        current_period_end: subscription.current_period_end,
        notification_resource_id: expirationResourceId,
        ...(notificationResult?.emailSent ? { expiration_email_sent_at: new Date().toISOString() } : {}),
        ...(notificationResult?.emailError ? { expiration_email_error: notificationResult.emailError } : {}),
      },
    });
    processed++;
  }

  const { data: reconciliation, error: reconciliationError } = await supabase.rpc('reconcile_expired_subscriptions', {
    p_merchant_id: targetMerchantId ?? null,
  });
  if (reconciliationError) {
    throw new Error(`Subscription reconciliation failed: ${reconciliationError.message}`);
  }

  const expirationEmails = await dispatchPendingSubscriptionExpirationEmails(targetMerchantId);

  return { processed, reconciliation, expirationEmails };
}

export function createSubscriptionLedgerReference() {
  return `SUB_${randomUUID().substring(0, 8).toUpperCase()}`;
}
