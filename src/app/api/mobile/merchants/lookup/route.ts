import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const email = searchParams.get('email');
    const id = searchParams.get('id');

    if (!email && !id) {
      return NextResponse.json({ error: "Email ou ID requis." }, { status: 400 });
    }

    // Lookup merchant by email or id
    let query = supabaseAdmin.from('merchants').select('id, business_name, email, status, kyc_status');
    
    if (email) {
      query = query.eq('email', email.trim());
    } else if (id) {
      query = query.eq('id', id.trim());
    }

    const { data: merchant, error: merchantError } = await query.single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Aucun marchand trouvé avec ces informations." }, { status: 404 });
    }

    // Don't allow transferring to self
    const { data: sender } = await supabaseAdmin
      .from('merchants')
      .select('id')
      .eq('user_id', payload.sub)
      .single();

    if (sender && sender.id === merchant.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas vous transférer de l'argent à vous-même." }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      merchant: {
        id: merchant.id,
        business_name: merchant.business_name,
        email: merchant.email,
        status: merchant.status,
        kyc_status: merchant.kyc_status
      }
    });
    
  } catch (error: any) {
    console.error("Merchant lookup error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
