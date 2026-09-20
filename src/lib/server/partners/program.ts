import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getMerchantCurrentPlan } from '@/lib/server/plans';
import {
  calculateDeveloperCommission,
  DEVELOPER_INTEGRATION_LIMITS,
  getDeveloperCommissionRate,
  getDeveloperTier,
  isMerchantReferralQualified,
} from '@/lib/partners/program-rules';

type SupportedCurrency = 'HTG' | 'USD';

type SuccessfulPayment = {
  id: string;
  merchant_id: string;
  amount: number | string;
  currency: string;
  environment?: string | null;
  api_key_origin?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function checkDeveloperPaymentCapacity(input: {
  connectionId: string;
  amount: number;
  currency: string;
}) {
  const currency = String(input.currency).toUpperCase();
  if (currency !== 'HTG' && currency !== 'USD') {
    return { allowed: false, currency, used: 0, limit: 0, remaining: 0 };
  }

  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from('developer_merchant_connections')
    .select('status, integration_htg_total, integration_usd_total')
    .eq('id', input.connectionId)
    .maybeSingle();
  if (error) throw new Error(`Developer capacity lookup failed: ${error.message}`);
  if (!connection || connection.status === 'revoked') {
    return { allowed: false, currency, used: 0, limit: 0, remaining: 0 };
  }
  if (connection.status === 'live') {
    return { allowed: true, currency, used: 0, limit: null, remaining: null };
  }

  const used = Number(currency === 'HTG'
    ? connection.integration_htg_total
    : connection.integration_usd_total);
  const limit = DEVELOPER_INTEGRATION_LIMITS[currency];
  const remaining = Math.max(0, limit - used);
  return {
    allowed: Number.isFinite(input.amount) && input.amount > 0 && input.amount <= remaining,
    currency,
    used,
    limit,
    remaining,
  };
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

async function hasActiveProPlan(merchantId: string): Promise<boolean> {
  const { plan, entitlement } = await getMerchantCurrentPlan(merchantId);
  return plan?.slug === 'pro' && entitlement.canUsePaidFeatures;
}

async function refreshDeveloperTier(developerId: string) {
  const supabase = createAdminClient();
  const [{ count, error: countError }, { data: developer, error: developerError }] = await Promise.all([
    supabase
      .from('developer_merchant_connections')
      .select('id', { count: 'exact', head: true })
      .eq('developer_id', developerId)
      .eq('status', 'live'),
    supabase
      .from('developer_accounts')
      .select('tier, commission_rate_override, status')
      .eq('id', developerId)
      .single(),
  ]);

  if (countError) throw new Error(`Developer active merchant count failed: ${countError.message}`);
  if (developerError || !developer) throw new Error('Developer account not found');

  const tier = getDeveloperTier(count ?? 0);
  if (developer.tier !== tier) {
    const { error } = await supabase
      .from('developer_accounts')
      .update({ tier })
      .eq('id', developerId);
    if (error) throw new Error(`Developer tier update failed: ${error.message}`);
  }

  return {
    status: developer.status as string,
    tier,
    commissionRate: getDeveloperCommissionRate(tier, developer.commission_rate_override),
  };
}

async function creditDeveloperActivationBonus(connectionId: string) {
  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from('developer_merchant_connections')
    .select('id, developer_id, merchant_id, first_merchant_api_payment_id, developer_bonus_credited_at')
    .eq('id', connectionId)
    .maybeSingle();

  if (error) throw new Error(`Developer connection lookup failed: ${error.message}`);
  if (!connection?.first_merchant_api_payment_id || connection.developer_bonus_credited_at) return;
  if (!(await hasActiveProPlan(connection.merchant_id))) return;

  const { data: developer } = await supabase
    .from('developer_accounts')
    .select('status')
    .eq('id', connection.developer_id)
    .maybeSingle();
  if (developer?.status !== 'active') return;

  const { error: ledgerError } = await supabase.from('partner_commission_ledger').insert({
    beneficiary_type: 'developer',
    developer_id: connection.developer_id,
    source_merchant_id: connection.merchant_id,
    source_payment_id: connection.first_merchant_api_payment_id,
    entry_type: 'developer_activation_bonus',
    amount: 10,
    currency: 'USD',
    status: 'available',
    available_at: new Date().toISOString(),
    idempotency_key: `developer_activation_bonus:${connection.id}`,
    metadata: { developer_connection_id: connection.id },
  });
  if (ledgerError && !isUniqueViolation(ledgerError)) {
    throw new Error(`Developer activation bonus failed: ${ledgerError.message}`);
  }

  const { error: updateError } = await supabase
    .from('developer_merchant_connections')
    .update({ developer_bonus_credited_at: new Date().toISOString() })
    .eq('id', connection.id)
    .is('developer_bonus_credited_at', null);
  if (updateError) throw new Error(`Developer bonus marker failed: ${updateError.message}`);
}

async function markDeveloperConnectionLive(merchantId: string, paymentId: string) {
  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from('developer_merchant_connections')
    .select('id, status, live_at, first_merchant_api_payment_id')
    .eq('merchant_id', merchantId)
    .neq('status', 'revoked')
    .maybeSingle();

  if (error) throw new Error(`Developer connection lookup failed: ${error.message}`);
  if (!connection) return;

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('developer_merchant_connections')
    .update({
      status: 'live',
      live_at: connection.live_at ?? now,
      first_merchant_api_payment_id: connection.first_merchant_api_payment_id ?? paymentId,
    })
    .eq('id', connection.id)
    .neq('status', 'revoked');
  if (updateError) throw new Error(`Developer connection Live transition failed: ${updateError.message}`);

  await creditDeveloperActivationBonus(connection.id);
}

async function creditDeveloperTransactionCommission(
  payment: SuccessfulPayment,
  connectionId: string,
) {
  const supabase = createAdminClient();
  const { data: connection, error } = await supabase
    .from('developer_merchant_connections')
    .select('developer_id, merchant_id, status')
    .eq('id', connectionId)
    .eq('merchant_id', payment.merchant_id)
    .maybeSingle();

  if (error) throw new Error(`Developer commission connection lookup failed: ${error.message}`);
  if (!connection || connection.status === 'revoked') return;

  const developer = await refreshDeveloperTier(connection.developer_id);
  if (developer.status !== 'active' || developer.commissionRate === null) return;

  const currency = String(payment.currency).toUpperCase();
  if (currency !== 'HTG' && currency !== 'USD') return;
  const amount = calculateDeveloperCommission(Number(payment.amount), developer.commissionRate);
  if (amount <= 0) return;

  const { error: ledgerError } = await supabase.from('partner_commission_ledger').insert({
    beneficiary_type: 'developer',
    developer_id: connection.developer_id,
    source_merchant_id: payment.merchant_id,
    source_payment_id: payment.id,
    entry_type: 'developer_transaction_commission',
    amount,
    currency,
    status: 'available',
    available_at: new Date().toISOString(),
    idempotency_key: `developer_transaction_commission:${payment.id}`,
    metadata: {
      developer_connection_id: connectionId,
      tier: developer.tier,
      commission_rate_percent: developer.commissionRate,
      kobara_revenue_rate_percent: 1,
    },
  });
  if (ledgerError && !isUniqueViolation(ledgerError)) {
    throw new Error(`Developer transaction commission failed: ${ledgerError.message}`);
  }
}

async function refreshMerchantReferral(referralId: string) {
  const supabase = createAdminClient();
  const [{ data: referral, error: referralError }, { data: credits, error: creditsError }] = await Promise.all([
    supabase
      .from('merchant_referrals')
      .select('id, referrer_merchant_id, invited_merchant_id, status, reward_currency, pro_activated_at')
      .eq('id', referralId)
      .maybeSingle(),
    supabase
      .from('merchant_referral_payment_credits')
      .select('amount, currency')
      .eq('merchant_referral_id', referralId),
  ]);

  if (referralError) throw new Error(`Merchant referral lookup failed: ${referralError.message}`);
  if (creditsError) throw new Error(`Merchant referral credits lookup failed: ${creditsError.message}`);
  if (!referral?.invited_merchant_id || ['expired', 'revoked', 'ineligible'].includes(referral.status)) return;

  const totals = (credits ?? []).reduce((sum, credit) => {
    const currency = String(credit.currency).toUpperCase() as SupportedCurrency;
    if (currency === 'HTG' || currency === 'USD') sum[currency] += Number(credit.amount);
    return sum;
  }, { HTG: 0, USD: 0 });
  const proActive = await hasActiveProPlan(referral.invited_merchant_id);
  const qualified = isMerchantReferralQualified({
    hasActiveProPlan: proActive,
    htgTotal: totals.HTG,
    usdTotal: totals.USD,
  });

  const now = new Date().toISOString();
  const nextStatus = qualified ? 'qualified' : proActive ? 'volume_pending' : 'account_created';
  const { error: updateError } = await supabase
    .from('merchant_referrals')
    .update({
      qualifying_htg_total: totals.HTG,
      qualifying_usd_total: totals.USD,
      pro_activated_at: proActive ? referral.pro_activated_at ?? now : referral.pro_activated_at,
      qualified_at: qualified ? now : null,
      status: nextStatus,
    })
    .eq('id', referral.id)
    .neq('status', 'rewarded');
  if (updateError) throw new Error(`Merchant referral update failed: ${updateError.message}`);
  if (!qualified) return;

  const currency = referral.reward_currency as SupportedCurrency;
  const rewardAmount = currency === 'USD' ? 5 : 675;
  const { error: ledgerError } = await supabase.from('partner_commission_ledger').insert({
    beneficiary_type: 'merchant_referral',
    merchant_id: referral.referrer_merchant_id,
    source_merchant_id: referral.invited_merchant_id,
    entry_type: 'merchant_referral_reward',
    amount: rewardAmount,
    currency,
    status: 'available',
    available_at: now,
    idempotency_key: `merchant_referral_reward:${referral.id}`,
    metadata: { merchant_referral_id: referral.id },
  });
  if (ledgerError && !isUniqueViolation(ledgerError)) {
    throw new Error(`Merchant referral reward failed: ${ledgerError.message}`);
  }

  const { error: rewardedError } = await supabase
    .from('merchant_referrals')
    .update({ status: 'rewarded', rewarded_at: now, qualified_at: now })
    .eq('id', referral.id);
  if (rewardedError) throw new Error(`Merchant referral reward marker failed: ${rewardedError.message}`);
}

async function recordMerchantReferralPayment(payment: SuccessfulPayment, referralId: string) {
  const currency = String(payment.currency).toUpperCase();
  if (currency !== 'HTG' && currency !== 'USD') return;

  const supabase = createAdminClient();
  const { error } = await supabase.from('merchant_referral_payment_credits').insert({
    merchant_referral_id: referralId,
    payment_id: payment.id,
    amount: Number(payment.amount),
    currency,
  });
  if (error && !isUniqueViolation(error)) {
    throw new Error(`Merchant referral payment credit failed: ${error.message}`);
  }
  await refreshMerchantReferral(referralId);
}

async function creditAmbassadorPlanReward(merchantId: string, subscriptionId: string) {
  const supabase = createAdminClient();
  const { data: attribution, error } = await supabase
    .from('referral_attributions')
    .select('ambassador_id')
    .eq('merchant_id', merchantId)
    .eq('source_type', 'ambassador_promo')
    .maybeSingle();
  if (error) throw new Error(`Ambassador attribution lookup failed: ${error.message}`);
  if (!attribution?.ambassador_id) return;

  const { data: ambassador } = await supabase
    .from('ambassador_accounts')
    .select('status, reward_currency')
    .eq('id', attribution.ambassador_id)
    .maybeSingle();
  if (!ambassador || ambassador.status !== 'active') return;

  const currency = ambassador.reward_currency as SupportedCurrency;
  const amount = currency === 'USD' ? 5 : 675;
  const { error: ledgerError } = await supabase.from('partner_commission_ledger').insert({
    beneficiary_type: 'ambassador',
    ambassador_id: attribution.ambassador_id,
    source_merchant_id: merchantId,
    source_subscription_id: subscriptionId,
    entry_type: 'ambassador_plan_reward',
    amount,
    currency,
    status: 'available',
    available_at: new Date().toISOString(),
    idempotency_key: `ambassador_plan_reward:${merchantId}`,
    metadata: { subscription_id: subscriptionId },
  });
  if (ledgerError && !isUniqueViolation(ledgerError)) {
    throw new Error(`Ambassador plan reward failed: ${ledgerError.message}`);
  }
}

export async function processPartnerPaymentSuccess(payment: SuccessfulPayment) {
  if (payment.environment !== 'live' || payment.metadata?.is_subscription_upgrade) return;

  if (payment.api_key_origin === 'merchant') {
    await markDeveloperConnectionLive(payment.merchant_id, payment.id);
  }

  const supabase = createAdminClient();
  const { data: attribution, error } = await supabase
    .from('referral_attributions')
    .select('source_type, developer_connection_id, merchant_referral_id')
    .eq('merchant_id', payment.merchant_id)
    .maybeSingle();
  if (error) throw new Error(`Partner attribution lookup failed: ${error.message}`);
  if (!attribution) return;

  if (attribution.source_type === 'developer_referral' && attribution.developer_connection_id) {
    await creditDeveloperTransactionCommission(payment, attribution.developer_connection_id);
  }
  if (attribution.source_type === 'merchant_referral' && attribution.merchant_referral_id) {
    await recordMerchantReferralPayment(payment, attribution.merchant_referral_id);
  }
}

export async function processPartnerPlanActivation(input: {
  merchantId: string;
  subscriptionId: string;
  planSlug: string;
}) {
  if (input.planSlug !== 'pro') return;

  const supabase = createAdminClient();
  const { data: connection } = await supabase
    .from('developer_merchant_connections')
    .select('id')
    .eq('merchant_id', input.merchantId)
    .neq('status', 'revoked')
    .maybeSingle();
  if (connection) await creditDeveloperActivationBonus(connection.id);

  await creditAmbassadorPlanReward(input.merchantId, input.subscriptionId);

  const { data: attribution } = await supabase
    .from('referral_attributions')
    .select('merchant_referral_id')
    .eq('merchant_id', input.merchantId)
    .eq('source_type', 'merchant_referral')
    .maybeSingle();
  if (attribution?.merchant_referral_id) {
    await refreshMerchantReferral(attribution.merchant_referral_id);
  }
}
