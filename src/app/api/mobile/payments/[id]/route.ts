import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    // 2. Get merchant profile
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    // 3. Get payment details with customer and payment link info
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        customers (
          id,
          name,
          email,
          phone
        ),
        payment_links (
          id,
          title,
          description
        )
      `)
      .eq('merchant_id', merchant.id)
      .eq('id', id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ payment });
  } catch (error: any) {
    console.error("Payment details error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
