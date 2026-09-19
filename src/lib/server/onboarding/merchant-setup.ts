import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';

export type IntegrationChoice = 'payment_link' | 'api' | null;

export type MerchantSetupGuide = {
  hidden: boolean;
  kycApproved: boolean;
  integrationChoice: IntegrationChoice;
  steps: {
    profile: boolean;
    kyc: boolean;
    paymentMethods: boolean;
    integration: boolean;
    webhook: boolean;
    firstPayment: boolean;
  };
};

function hasAddress(value: unknown) {
  if (!value) return false;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Boolean(parsed?.address || parsed?.city || parsed?.country);
    } catch {
      return value.trim().length > 2;
    }
  }
  return typeof value === 'object' && Boolean((value as { address?: string }).address);
}

export async function getMerchantSetupGuide(merchant: any): Promise<MerchantSetupGuide> {
  const admin = createAdminClient();
  const [userResult, progressResult, linkResult, keyResult, webhookResult, paymentsResult] = await Promise.all([
    admin.from('users').select('first_name, last_name').eq('id', merchant.user_id).maybeSingle(),
    admin.from('merchant_setup_progress').select('*').eq('merchant_id', merchant.id).maybeSingle(),
    admin.from('payment_links').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant.id).eq('environment', 'live'),
    admin.from('api_keys').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant.id).eq('environment', 'live').is('revoked_at', null),
    admin.from('webhook_endpoints').select('id', { count: 'exact', head: true }).eq('merchant_id', merchant.id).eq('environment', 'live').eq('status', 'active'),
    admin.from('payments').select('id, metadata').eq('merchant_id', merchant.id).eq('environment', 'live').in('status', ['succeeded', 'completed']).order('created_at', { ascending: false }).limit(20),
  ]);

  const progress = progressResult.data;
  const hasLink = Number(linkResult.count || 0) > 0;
  const hasKey = Number(keyResult.count || 0) > 0;
  const choice: IntegrationChoice = progress?.integration_choice || (hasLink ? 'payment_link' : hasKey ? 'api' : null);
  const firstPayment = (paymentsResult.data || []).some((payment: any) => !payment.metadata?.is_subscription_upgrade);
  const profile = Boolean(
    userResult.data?.first_name && userResult.data?.last_name && merchant.business_name &&
    merchant.phone && merchant.category && hasAddress(merchant.address),
  );
  const kycApproved = merchant.kyc_status === 'approved';
  const integration = choice === 'payment_link' ? hasLink : choice === 'api' ? hasKey : false;
  const webhook = choice === 'payment_link' || (choice === 'api' && Number(webhookResult.count || 0) > 0);

  if (firstPayment && !progress?.onboarding_completed_at) {
    await admin.from('merchant_setup_progress').upsert({
      merchant_id: merchant.id,
      integration_choice: choice,
      onboarding_completed_at: new Date().toISOString(),
    }, { onConflict: 'merchant_id' });
  }

  return {
    hidden: Boolean(progress?.onboarding_completed_at || firstPayment),
    kycApproved,
    integrationChoice: choice,
    steps: {
      profile,
      kyc: kycApproved,
      paymentMethods: Boolean(progress?.payment_methods_confirmed_at),
      integration,
      webhook,
      firstPayment,
    },
  };
}
