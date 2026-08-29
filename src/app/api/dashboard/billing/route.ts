import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { getMerchantCurrentPlan } from "@/lib/server/plans";
import { getMonthlyPaymentCount, getDailyWithdrawalTotal, getApiKeysCount } from "@/lib/server/usage";
import { reconcilePendingSubscriptionPayments } from '@/lib/server/payments/reconcile-subscriptions';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', (session.user as any).id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    await reconcilePendingSubscriptionPayments(merchant.id);

    const [{ plan, subscription, merchant: merchantData, entitlement }, providerConfig] = await Promise.all([
      getMerchantCurrentPlan(merchant.id),
      getPaymentProviderConfig(),
    ]);
    
    // Get usage stats
    const paymentsCount = await getMonthlyPaymentCount(merchant.id);
    const withdrawalsTotal = await getDailyWithdrawalTotal(merchant.id);
    const apiKeysCount = await getApiKeysCount(merchant.id);

    return NextResponse.json({
      data: {
        plan,
        subscription,
        merchant: merchantData,
        entitlement,
        providerConfig,
        usage: {
          monthly_payments: paymentsCount,
          daily_withdrawals: withdrawalsTotal,
          api_keys: apiKeysCount
        }
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
