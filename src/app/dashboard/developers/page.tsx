import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { DevelopersClient } from "./developers-client";
import { getMerchantSubscriptionEntitlement } from '@/lib/server/plans';
import { redirect } from 'next/navigation';

export default async function DevelopersPage() {
  const session = await auth();
  const user = session?.user as any;

  if (!user) {
    redirect('/login');
  }

  // ── Authenticated user ── fetch real data using admin client
  const supabase = createAdminClient();

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, status, plan_slug, kyc_status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!merchant) {
    redirect('/onboarding');
  }

  const merchantId = merchant.id;
  const subscriptionAccess = await getMerchantSubscriptionEntitlement(merchantId);
  const effectivePlan = subscriptionAccess.plan;

  // Get API keys (prefix only — full key never stored in plain text)
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('prefix, environment')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false });

  let livePublicKey = 'kobara_pk_live_...';

  if (apiKeys) {
    const liveKey = apiKeys.find(k => k.environment === 'live');
    if (liveKey) livePublicKey = liveKey.prefix + '...';
  }

  // Get webhook status
  const { data: webhooks } = await supabase
    .from('webhook_endpoints')
    .select('url, status')
    .eq('merchant_id', merchantId)
    .eq('environment', 'live')
    .eq('status', 'active')
    .limit(1);

  const webhook = webhooks && webhooks.length > 0
    ? { configured: true, url: webhooks[0].url }
    : { configured: false, url: null };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.toISOString();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // Get API calls today (using audit_logs as proxy)
  const { count: apiCallsToday } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .gte('created_at', startOfDay);

  // Get payments this month
  const { count: paymentsThisMonth } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('environment', 'live')
    .gte('created_at', startOfMonth);

  const usage = {
    apiCallsToday: apiCallsToday || 0,
    paymentsThisMonth: paymentsThisMonth || 0,
    planLimit: effectivePlan?.monthly_payment_limit ?? 1000
  };

  let planName = "Free";
  if (effectivePlan?.name) planName = effectivePlan.name;

  const subscription = {
    plan: planName,
    status: subscriptionAccess.entitlement.isGracePeriod
      ? 'Délai de grâce'
      : subscriptionAccess.entitlement.isExpired
        ? 'Expiré - Plan gratuit'
        : 'Actif'
  };

  return (
    <DevelopersClient
      merchant={merchant}
      livePublicKey={livePublicKey}
      webhook={webhook}
      usage={usage}
      subscription={subscription}
    />
  );
}
