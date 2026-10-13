import { createAdminClient } from "@/utils/supabase/admin";
import { getWithdrawalDayBounds } from "../withdrawal-day";

type SupabaseRpcError = {
  code?: string;
  message?: string;
};

function isMissingQuotaFunction(error: SupabaseRpcError) {
  return error.code === 'PGRST202'
    || error.code === '42883'
    || /function .* does not exist|schema cache/i.test(error.message || '');
}

function utcBounds(period: 'month' | 'day') {
  const now = new Date();
  const start = period === 'month'
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = period === 'month'
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function getMonthlyPaymentCount(merchantId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_monthly_billable_payment_count', {
    p_merchant_id: merchantId,
  });

  if (error) {
    if (isMissingQuotaFunction(error)) {
      const { start, end } = utcBounds('month');
      const { data: payments, error: fallbackError } = await supabase
        .from('payments')
        .select('provider, payment_source, metadata')
        .eq('merchant_id', merchantId)
        .eq('environment', 'live')
        .gte('created_at', start)
        .lt('created_at', end);
      if (!fallbackError) {
        return (payments || []).filter((payment) => {
          const metadata = payment.metadata as Record<string, unknown> | null;
          return payment.provider?.toLowerCase() !== 'b2b'
            && payment.payment_source?.toLowerCase() !== 'b2b'
            && metadata?.internal_transfer !== true
            && metadata?.is_subscription_upgrade !== true;
        }).length;
      }
      console.error("Erreur comptage paiements mensuels (fallback):", fallbackError);
    }
    console.error("Erreur comptage paiements mensuels:", error);
    throw new Error('payment_usage_unavailable');
  }
  return Number(data || 0);
}

export async function getDailyWithdrawalTotal(merchantId: string): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('get_daily_dashboard_withdrawal_total', {
    p_merchant_id: merchantId,
  });

  if (error) {
    if (isMissingQuotaFunction(error)) {
      const { start, end } = getWithdrawalDayBounds();
      const withdrawalsResult = await supabase
          .from('withdrawals')
          .select('total, amount, currency, exchange_rate, status, provider')
          .eq('merchant_id', merchantId)
          .eq('environment', 'live')
          .eq('request_source', 'dashboard')
          .gte('created_at', start)
          .lt('created_at', end);
      if (!withdrawalsResult.error) {
        const withdrawalsTotal = (withdrawalsResult.data || []).reduce((total, withdrawal) => {
          if (['failed', 'rejected', 'cancelled'].includes(withdrawal.status)
            || withdrawal.provider?.toLowerCase() === 'system_subscription') return total;
          const amount = Number(withdrawal.total ?? withdrawal.amount ?? 0);
          return total + (withdrawal.currency?.toUpperCase() === 'USD'
            ? amount * Number(withdrawal.exchange_rate || 130)
            : amount);
        }, 0);
        return withdrawalsTotal;
      }
      console.error("Erreur calcul sorties quotidiennes (fallback):", withdrawalsResult.error);
    }
    console.error("Erreur calcul sorties quotidiennes:", error);
    throw new Error('withdrawal_usage_unavailable');
  }
  return Number(data || 0);
}

export async function getApiKeysCount(merchantId: string, environment: 'test' | 'live' = 'live'): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  query = query.eq('environment', environment);

  const { count, error } = await query;

  if (error) {
    console.error("Erreur comptage API keys:", error);
    throw new Error('api_key_usage_unavailable');
  }
  return count || 0;
}

// These functions will be called by access.ts
