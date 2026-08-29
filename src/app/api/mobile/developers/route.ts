import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('user_id', payload.sub).single();
    if (!merchant) return NextResponse.json({ error: "Marchand introuvable." }, { status: 404 });

    const { data: members, error } = await supabaseAdmin
      .from('merchant_members')
      .select('*')
      .eq('merchant_id', merchant.id);

    if (error) throw error;

    return NextResponse.json({ success: true, data: members });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const body = await req.json();
    const { email, role, name } = body;

    const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('user_id', payload.sub).single();
    if (!merchant) return NextResponse.json({ error: "Marchand introuvable." }, { status: 404 });

    // Since we don't have a full invite system implemented in this route, we'll insert a member with status pending
    // Let's check if the table has a status column. For now we assume 'invited' or 'pending'.
    const { data: member, error } = await supabaseAdmin
      .from('merchant_members')
      .insert({
        merchant_id: merchant.id,
        user_id: null, // No user yet
        role: role || 'developer',
      })
      .select()
      .single();

    if (error) {
      console.error(error);
      return NextResponse.json({ error: "Erreur lors de l'invitation." }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: member });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });
    
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID manquant." }, { status: 400 });

    const { data: merchant } = await supabaseAdmin.from('merchants').select('id').eq('user_id', payload.sub as string).single();
    if (!merchant) return NextResponse.json({ error: "Marchand introuvable." }, { status: 404 });

    const { error } = await supabaseAdmin
      .from('merchant_members')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchant.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
