import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { ApiKeysClient } from "./api-keys-client";
import { getMerchantSubscriptionEntitlement } from '@/lib/server/plans';

export default async function ApiKeysPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  // Compute API calls metrics based on payments this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: recentPayments } = await supabase
    .from('payments')
    .select('status')
    .eq('merchant_id', merchant.id)
    .gte('created_at', oneWeekAgo.toISOString());

  const apiCallsThisWeek = recentPayments?.length || 0;
  const successfulCalls = recentPayments?.filter(p => p.status === 'succeeded').length || 0;
  
  const successRate = apiCallsThisWeek > 0 
    ? Math.round((successfulCalls / apiCallsThisWeek) * 100) 
    : 100;

  const subscriptionAccess = await getMerchantSubscriptionEntitlement(merchant.id);

  return <ApiKeysClient 
    merchant={{ ...merchant, ...subscriptionAccess.merchant }}
    apiKeysLimit={subscriptionAccess.plan ? subscriptionAccess.plan.api_keys_limit : 1}
    initialKeys={apiKeys || []} 
    apiCallsThisWeek={apiCallsThisWeek}
    successRate={successRate}
  />;
}
