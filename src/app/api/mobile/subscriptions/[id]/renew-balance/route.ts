import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, available_balance, available_balance_test, current_environment")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    const environment = merchant.current_environment || 'test';
    const isTest = environment === 'test';
    const balance = Number(isTest ? merchant.available_balance_test : merchant.available_balance);

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: "Abonnement introuvable." }, { status: 404 });
    }

    const amountHTG = Number(subscription.amount_htg);

    if (balance < amountHTG) {
      return NextResponse.json({ error: "Solde insuffisant pour renouveler l'abonnement." }, { status: 400 });
    }

    if (isTest) {
      return NextResponse.json({ error: "Le renouvellement d’un abonnement réel utilise le solde Live." }, { status: 400 });
    }

    const { data: renewed, error: renewalError } = await supabaseAdmin.rpc('renew_subscription_from_balance', {
      p_subscription_id: subscription.id,
    });
    if (renewalError || !renewed) {
      return NextResponse.json({ error: "Solde insuffisant ou renouvellement impossible." }, { status: 400 });
    }

    const { data: renewedSubscription } = await supabaseAdmin
      .from('subscriptions')
      .select('current_period_end')
      .eq('id', subscription.id)
      .single();

    return NextResponse.json({
      success: true,
      new_balance: balance - amountHTG,
      next_billing_date: renewedSubscription?.current_period_end,
    });
  } catch (error: any) {
    console.error("API /mobile/subscriptions/renew error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
