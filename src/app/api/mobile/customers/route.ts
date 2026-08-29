import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
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

    // 2. Fetch Customers
    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("environment", environment)
      .order("created_at", { ascending: false });

    if (customersError) {
      throw customersError;
    }

    // 3. Fetch successful payments to aggregate
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("payments")
      .select("customer_id, net_amount, amount, created_at")
      .eq("merchant_id", merchant.id)
      .eq("environment", environment)
      .eq("status", "succeeded");

    if (paymentsError) {
      throw paymentsError;
    }

    // Map payments to customers
    const customerStats: Record<string, { totalSpent: number; transactionCount: number; lastPaymentAt: number }> = {};
    
    if (payments) {
      for (const p of payments) {
        if (!p.customer_id) continue;
        if (!customerStats[p.customer_id]) {
          customerStats[p.customer_id] = { totalSpent: 0, transactionCount: 0, lastPaymentAt: 0 };
        }
        
        const amt = Number(p.net_amount || p.amount || 0);
        const pTime = new Date(p.created_at).getTime();
        
        customerStats[p.customer_id].totalSpent += amt;
        customerStats[p.customer_id].transactionCount += 1;
        
        if (pTime > customerStats[p.customer_id].lastPaymentAt) {
          customerStats[p.customer_id].lastPaymentAt = pTime;
        }
      }
    }

    // Aggregate summary metrics
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
    
    let activeClients = 0;
    let newClients = 0;

    const mappedCustomers = (customers || []).map(c => {
      const stats = customerStats[c.id] || { totalSpent: 0, transactionCount: 0, lastPaymentAt: 0 };
      const cTime = new Date(c.created_at).getTime();
      
      // Is new?
      if (cTime >= thirtyDaysAgo) {
        newClients++;
      }
      
      // Is active? (has a successful payment in last 30 days)
      if (stats.lastPaymentAt >= thirtyDaysAgo) {
        activeClients++;
      }

      return {
        id: c.id,
        name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim(),
        email: c.email,
        phone: c.phone,
        totalSpent: stats.totalSpent,
        transactionCount: stats.transactionCount,
        createdAt: c.created_at,
        lastPaymentAt: stats.lastPaymentAt > 0 ? new Date(stats.lastPaymentAt).toISOString() : null
      };
    });

    const summary = {
      totalClients: customers?.length || 0,
      activeClients,
      newClients,
    };

    return NextResponse.json({
      success: true,
      summary,
      customers: mappedCustomers
    });

  } catch (error: any) {
    console.error("API /mobile/customers error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
