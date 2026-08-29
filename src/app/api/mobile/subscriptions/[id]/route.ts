import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { evaluateSubscriptionEntitlement } from '@/lib/server/subscription-entitlement';

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, merchant_id, plan_id, amount_htg, status, billing_cycle, current_period_start, current_period_end, grace_period_end, cancel_at_period_end, payment_status, created_at, plan:plans(*)')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
    }

    const formattedSubscription = {
      id: subscription.id,
      amount: subscription.amount_htg,
      status: subscription.status,
      billing_interval: subscription.billing_cycle,
      next_billing_date: subscription.current_period_end,
      grace_period_end: subscription.grace_period_end,
      payment_status: subscription.payment_status,
      created_at: subscription.created_at,
      plans: subscription.plan,
      entitlement: evaluateSubscriptionEntitlement(subscription as any),
      currency: 'HTG',
      customers: { name: merchant.business_name }
    };

    return NextResponse.json({ success: true, subscription: formattedSubscription });
  } catch (error: any) {
    console.error("API /mobile/subscriptions/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
