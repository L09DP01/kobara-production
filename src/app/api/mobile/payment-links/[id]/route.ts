import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      .select("id")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    const { data: link, error: linkError } = await supabaseAdmin
      .from('payment_links')
      .select(`
        *,
        payments(
          id,
          amount,
          status,
          created_at,
          payment_method,
          transaction_reference,
          customers(name, email, phone)
        )
      `)
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (linkError) {
      console.error("Link error:", linkError);
      return NextResponse.json({ error: `Erreur BD: ${linkError.message}` }, { status: 404 });
    }
    if (!link) {
      return NextResponse.json({ error: "Lien introuvable." }, { status: 404 });
    }

    // Attach payment count and the payments list
    const payment_count = link.payments ? link.payments.length : 0;
    const payments = link.payments || [];
    delete link.payments;

    return NextResponse.json({ success: true, link: { ...link, payment_count }, payments });
  } catch (error: any) {
    console.error("API GET /mobile/payment-links/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    const body = await req.json();
    const { status, title, description, amount } = body;

    // Verify ownership
    const { data: link, error: linkError } = await supabaseAdmin
      .from('payment_links')
      .select('id')
      .eq('id', id)
      .eq('merchant_id', merchant.id)
      .single();

    if (linkError || !link) {
      return NextResponse.json({ error: "Lien introuvable ou accès refusé." }, { status: 404 });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (amount !== undefined) updates.amount = Number(amount);

    const { data: updatedLink, error: updateError } = await supabaseAdmin
      .from('payment_links')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating link:", updateError);
      return NextResponse.json({ error: "Erreur lors de la mise à jour." }, { status: 500 });
    }

    return NextResponse.json({ success: true, link: updatedLink });
  } catch (error: any) {
    console.error("API PATCH /mobile/payment-links/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable." }, { status: 404 });
    }

    // Since we have foreign key constraints, maybe we just set it to inactive instead of actually deleting,
    // or actually delete it if there are no payments.
    // If there are payments, ON DELETE SET NULL is set for payment_links in the schema (wait, is it?).
    // Let's try to delete it.
    const { error: deleteError } = await supabaseAdmin
      .from('payment_links')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchant.id);

    if (deleteError) {
      console.error("Error deleting link:", deleteError);
      return NextResponse.json({ error: "Impossible de supprimer ce lien (il a peut-être des paiements associés)." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API DELETE /mobile/payment-links/[id] error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
