import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const body = await req.json();
    const { expo_push_token, device_info } = body;

    if (!expo_push_token) {
      return NextResponse.json({ error: "Token Expo manquant." }, { status: 400 });
    }

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", payload.sub)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Marchand introuvable." }, { status: 404 });
    }

    // Upsert the device token
    const { error: upsertError } = await supabaseAdmin
      .from("merchant_devices")
      .upsert({
        merchant_id: merchant.id,
        expo_push_token,
        device_info: device_info || {},
        last_active_at: new Date().toISOString()
      }, { onConflict: 'merchant_id, expo_push_token' });

    if (upsertError) {
      console.error("[Push Register Error]:", upsertError);
      return NextResponse.json({ error: "Impossible d'enregistrer l'appareil." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
