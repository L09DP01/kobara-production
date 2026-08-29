import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      .select("id, current_environment")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" },
        { status: 404 }
      );
    }

    const environment = merchant.current_environment || 'test';
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // 3. Query Payments
    let query = supabaseAdmin
      .from('payments')
      .select('id, amount, net_amount, currency, status, provider, payment_method, created_at, kobara_reference, bazik_transaction_id, customers(name, email)', { count: 'exact' })
      .eq('merchant_id', merchant.id)
      .eq('environment', environment)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      // Pour la recherche, Supabase ne permet pas de chercher dans un objet joint facilement avec ilike
      // Donc on cherche dans transaction_reference ou bazik_transaction_id
      query = query.or(`transaction_reference.ilike.%${search}%,bazik_transaction_id.ilike.%${search}%`);
    }

    const { data: payments, count, error: paymentsError } = await query;

    if (paymentsError) {
      console.error("Error fetching mobile payments:", paymentsError);
      return NextResponse.json({ error: "Erreur lors de la récupération des paiements." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      payments: payments || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error: any) {
    console.error("API /mobile/payments error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
