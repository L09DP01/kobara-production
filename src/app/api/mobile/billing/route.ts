import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMerchantCurrentPlan } from "@/lib/server/plans";
import { getMonthlyPaymentCount, getDailyWithdrawalTotal, getApiKeysCount } from "@/lib/server/usage";

export async function GET(request: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(request);
    
    if (errorResponse) return errorResponse;

    if (!payload || !payload.sub) {
      return NextResponse.json({ error: "Token invalide." }, { status: 401 });
    }

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    const { plan, subscription, merchant: merchantData, entitlement } = await getMerchantCurrentPlan(merchant.id);
    
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
        usage: {
          monthly_payments: paymentsCount,
          daily_withdrawals: withdrawalsTotal,
          api_keys: apiKeysCount
        }
      }
    });

  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || "Server Error" }, { status: 500 });
  }
}
