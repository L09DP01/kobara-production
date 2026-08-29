import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { evaluateSubscriptionEntitlement } from '@/lib/server/subscription-entitlement';

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, current_environment, business_name")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" }, { status: 404 });
    }

    const environment = merchant.current_environment || 'test';
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('subscriptions')
      .select('id, merchant_id, plan_id, amount_htg, status, billing_cycle, current_period_start, current_period_end, grace_period_end, cancel_at_period_end, payment_status, created_at, plan:plans(*)', { count: 'exact' })
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      // Pas de recherche par défaut pour les plans.
    }

    const { data: subscriptions, count, error: subscriptionsError } = await query;

    if (subscriptionsError) {
      if (subscriptionsError.code === '42P01') {
        return NextResponse.json({ success: true, subscriptions: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      }
      console.error("Error fetching mobile subscriptions:", subscriptionsError);
      return NextResponse.json({ error: "Erreur lors de la récupération des abonnements." }, { status: 500 });
    }
    
    // Add default currency HTG and map customers to merchant business name for display
    const formattedSubscriptions = (subscriptions || []).map((sub: any) => ({
      id: sub.id,
      amount: sub.amount_htg,
      status: sub.status,
      billing_interval: sub.billing_cycle,
      next_billing_date: sub.current_period_end,
      grace_period_end: sub.grace_period_end,
      payment_status: sub.payment_status,
      created_at: sub.created_at,
      plans: sub.plan,
      entitlement: evaluateSubscriptionEntitlement(sub),
      currency: 'HTG',
      customers: { name: merchant.business_name }
    }));

    return NextResponse.json({
      success: true,
      subscriptions: formattedSubscriptions,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error: any) {
    console.error("API /mobile/subscriptions error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
