import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    // 1. Fetch Merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, current_environment")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" }, { status: 404 });
    }

    const environment = merchant.current_environment || 'test';

    // 2. Fetch Customer Details
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("environment", environment)
      .eq("id", params.id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: "Client introuvable." }, { status: 404 });
    }

    // 3. Fetch Customer Payments
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("id, amount, net_amount, fee_amount, currency, status, provider, payment_method, created_at, kobara_reference")
      .eq("merchant_id", merchant.id)
      .eq("environment", environment)
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    // Prepare response
    const name = customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    
    // Calculate stats
    const successfulPayments = (payments || []).filter(p => p.status === 'succeeded' || p.status === 'completed');
    const totalSpent = successfulPayments.reduce((sum, p) => sum + Number(p.net_amount || p.amount || 0), 0);
    const totalFees = successfulPayments.reduce((sum, p) => sum + Number(p.fee_amount || 0), 0);

    return NextResponse.json({
      id: customer.id,
      name: name || 'Client sans nom',
      email: customer.email,
      phone: customer.phone,
      wallet: customer.wallet,
      createdAt: customer.created_at,
      stats: {
        totalSpent,
        totalFees,
        transactionCount: successfulPayments.length,
        totalTransactions: (payments || []).length
      },
      payments: payments || []
    });

  } catch (error: any) {
    console.error("API /mobile/customers/[id] error:", error);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
