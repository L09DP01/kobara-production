import { createAdminClient } from '@/utils/supabase/admin';

export type FundsAvailability = {
  currency: 'HTG' | 'USD';
  environment: 'test' | 'live';
  totalBalance: number;
  withdrawableBalance: number;
  pendingReleaseBalance: number;
  nextReleaseAt: string | null;
};

export async function getMerchantFundsAvailability(
  merchantId: string,
  environment: 'test' | 'live',
  currency: 'HTG' | 'USD',
  fallbackTotal = 0,
): Promise<FundsAvailability> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_merchant_funds_availability', {
    p_merchant_id: merchantId,
    p_environment: environment,
    p_currency: currency,
  });

  if (error || !data) {
    console.error('[FundsAvailability] Unable to load withdrawal availability:', error);
    return {
      currency,
      environment,
      totalBalance: Number(fallbackTotal || 0),
      withdrawableBalance: Number(fallbackTotal || 0),
      pendingReleaseBalance: 0,
      nextReleaseAt: null,
    };
  }

  return {
    currency,
    environment,
    totalBalance: Number(data.total_balance || 0),
    withdrawableBalance: Number(data.withdrawable_balance || 0),
    pendingReleaseBalance: Number(data.pending_release_balance || 0),
    nextReleaseAt: data.next_release_at || null,
  };
}
