import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getMerchantSubscriptionEntitlement } from '@/lib/server/plans';
import { PayPalService } from '@/lib/server/payments/paypal';
import { getMerchantFundsAvailability } from '@/lib/server/withdrawals/funds-availability';

export async function GET(req: NextRequest) {
  try {
    // 1. Vérification du JWT
    const { payload, errorResponse } = await verifyMobileToken(req);
    
    if (errorResponse) {
      return errorResponse;
    }

    if (!payload || !payload.sub) {
      return NextResponse.json({ error: "Token invalide." }, { status: 401 });
    }

    const userId = payload.sub;

    // 2. Fetch Merchant Profile
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, user_id, business_name, business_slug, logo_url, email, phone, address, category, status, kyc_status, plan_slug, available_balance, available_balance_usd, pending_balance, paypal_enabled, has_usd_account")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (merchant.kyc_status !== 'approved') {
      return NextResponse.json({
        error: "La verification KYC est requise pour acceder au tableau de bord.",
        code: "KYC_REQUIRED",
      }, { status: 403 });
    }

    const environment = 'live';
    const subscriptionAccess = await getMerchantSubscriptionEntitlement(merchant.id);
    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    const availableBalanceHtg = Number(merchant.available_balance || 0);
    const availableBalanceUsd = Number(merchant.available_balance_usd || 0);
    const htgFunds = await getMerchantFundsAvailability(merchant.id, 'live', 'HTG', availableBalanceHtg);
    const balances: Record<string, number> = { HTG: availableBalanceHtg };
    if (usdAccount.isActive) balances.USD = availableBalanceUsd;

    // 3. Fetch Recent Payments (Limit 10)
    const { data: recentPayments } = await supabaseAdmin
      .from('payments')
      .select('id, amount, net_amount, currency, status, provider, created_at, kobara_reference, customers(name)')
      .eq('merchant_id', merchant.id)
      .eq('environment', environment)
      .order('created_at', { ascending: false })
      .limit(10);

    // 4. Aggregate Stats (All time for total collected & rates, like Web App)
    const { data: allPayments } = await supabaseAdmin
      .from('payments')
      .select('amount, net_amount, status, created_at')
      .eq('merchant_id', merchant.id)
      .eq('environment', environment);

    let totalEncaisse = 0; // All time
    let successCount = 0;
    let failedCount = 0;
    let pendingCount = 0;
    let pendingAmount = 0;

    // Monthly data for growth
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    
    let currentMonthEncaisse = 0;
    
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    
    let lastMonthEncaisse = 0;
    let lastMonthSuccessCount = 0;
    let lastMonthFailedCount = 0;

    if (allPayments) {
      allPayments.forEach(p => {
        const amt = Number(p.net_amount || p.amount || 0);
        const pTime = new Date(p.created_at).getTime();

        // ALL TIME STATS
        if (p.status === 'succeeded') {
          totalEncaisse += amt;
          successCount++;
        } else if (p.status === 'pending') {
          pendingAmount += amt;
          pendingCount++;
        } else if (p.status === 'failed') {
          failedCount++;
        }

        // CURRENT MONTH STATS
        if (pTime >= monthStart) {
          if (p.status === 'succeeded') {
            currentMonthEncaisse += amt;
          }
        }
        
        // LAST MONTH STATS
        if (pTime >= lastMonthStart && pTime <= lastMonthEnd) {
          if (p.status === 'succeeded') {
            lastMonthEncaisse += amt;
            lastMonthSuccessCount++;
          } else if (p.status === 'failed') {
            lastMonthFailedCount++;
          }
        }
      });
    }

    const totalCount = successCount + failedCount + pendingCount;
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;
    const failedRate = totalCount > 0 ? (failedCount / totalCount) * 100 : 0;

    const lastMonthTotalCount = lastMonthSuccessCount + lastMonthFailedCount;
    const lastMonthSuccessRate = lastMonthTotalCount > 0 ? (lastMonthSuccessCount / lastMonthTotalCount) * 100 : 0;
    const lastMonthFailedRate = lastMonthTotalCount > 0 ? (lastMonthFailedCount / lastMonthTotalCount) * 100 : 0;

    let monthlyGrowth = 0;
    if (lastMonthEncaisse > 0) {
      monthlyGrowth = ((currentMonthEncaisse - lastMonthEncaisse) / lastMonthEncaisse) * 100;
    } else if (currentMonthEncaisse > 0) {
      monthlyGrowth = 100;
    }
    
    const successRateGrowth = successRate - lastMonthSuccessRate;
    const failedRateGrowth = failedRate - lastMonthFailedRate;

    // 5. Fetch Unread Notifications
    const { count: unreadCount } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id)
      .is('read_at', null);

    // --- DEBUG LOGS ---
    console.log("[Mobile Dashboard] Merchant ID:", merchant.id);
    console.log("[Mobile Dashboard] Environment:", environment);
    console.log("[Mobile Dashboard] Stats:", {
      total_collected: totalEncaisse,
      success_rate: successRate,
      failed_rate: failedRate,
      pending_amount: pendingAmount
    });
    console.log(`[Mobile Dashboard] Found ${recentPayments?.length || 0} recent payments`);
    // ------------------

    // 6. Format Response
    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.id,
        business_name: merchant.business_name,
        business_slug: merchant.business_slug,
        logo_url: merchant.logo_url,
        email: merchant.email,
        phone: merchant.phone,
        address: merchant.address,
        category: merchant.category,
        status: merchant.status,
        kyc_status: merchant.kyc_status,
        plan_slug: subscriptionAccess.entitlement.effectivePlan,
        subscription_entitlement: subscriptionAccess.entitlement,
        subscription_id: subscriptionAccess.subscription?.id ?? null,
      },
      stats: {
        total_collected: totalEncaisse,
        monthly_growth: monthlyGrowth,
        available_balance: availableBalanceHtg,
        withdrawable_balance: htgFunds.withdrawableBalance,
        local_payment_hold_hours: 12,
        available_balance_usd: usdAccount.isActive ? availableBalanceUsd : null,
        balances,
        usd_account: {
          created: usdAccount.hasAccount,
          active: usdAccount.isActive,
          status: usdAccount.status,
        },
        pending_amount: pendingAmount,
        success_rate: successRate,
        success_rate_growth: successRateGrowth,
        failed_rate: failedRate,
        failed_rate_growth: failedRateGrowth,
        currency: "HTG"
      },
      recentPayments: recentPayments || [],
      unreadNotifications: unreadCount || 0
    });

  } catch (error) {
    console.error("Dashboard summary API error:", error);
    return NextResponse.json(
      { error: "Erreur serveur.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
