import { createAdminClient } from "@/utils/supabase/admin";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";

export async function getMonthlyPaymentCount(merchantId: string): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date();
  
  const { count, error } = await supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .gte('created_at', startOfMonth(now).toISOString())
    .lte('created_at', endOfMonth(now).toISOString());

  if (error) {
    console.error("Erreur comptage paiements mensuels:", error);
    return 0;
  }
  return count || 0;
}

export async function getDailyWithdrawalTotal(merchantId: string): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date();
  const dayStart = startOfDay(now).toISOString();
  const dayEnd = endOfDay(now).toISOString();

  const [withdrawalsResult, transfersResult] = await Promise.all([
    supabase
      .from('withdrawals')
      .select('total, amount, currency, exchange_rate')
      .eq('merchant_id', merchantId)
      .or('environment.eq.live,environment.is.null')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)
      .not('status', 'eq', 'failed')
      .not('status', 'eq', 'rejected'),
    supabase
      .from('b2b_transfers')
      .select('amount')
      .eq('sender_id', merchantId)
      .eq('environment', 'live')
      .eq('status', 'completed')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd),
  ]);

  if (withdrawalsResult.error || transfersResult.error) {
    console.error("Erreur calcul sorties quotidiennes:", withdrawalsResult.error || transfersResult.error);
    throw new Error('withdrawal_usage_unavailable');
  }

  const withdrawalsTotal = withdrawalsResult.data.reduce((dailyTotalHtg, withdrawal) => {
    const grossAmount = Number(withdrawal.total ?? withdrawal.amount ?? 0);
    const exchangeRate = Number(withdrawal.exchange_rate || 130);
    return dailyTotalHtg + (withdrawal.currency === 'USD' ? grossAmount * exchangeRate : grossAmount);
  }, 0);

  const b2bTotal = transfersResult.data.reduce(
    (dailyTotalHtg, transfer) => dailyTotalHtg + Number(transfer.amount || 0),
    0,
  );

  return withdrawalsTotal + b2bTotal;
}

export async function getApiKeysCount(merchantId: string, environment?: 'test' | 'live'): Promise<number> {
  const supabase = createAdminClient();
  let query = supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId);

  if (environment) {
    query = query.eq('environment', environment);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Erreur comptage API keys:", error);
    return 0;
  }
  return count || 0;
}

// These functions will be called by access.ts
