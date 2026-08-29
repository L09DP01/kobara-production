import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { merchant, user } = await getCurrentUserAndMerchant();
    if (!merchant && !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { subject, message, priority = "urgent", category = "account_suspended" } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Le message ne peut pas être vide" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Insérer dans notifications ou support_tickets
    await supabase.from("risk_alerts").insert({
      merchant_id: merchant?.id || null,
      alert_type: "support_emergency_appeal",
      severity: "high",
      status: "open",
      description: `[Demande Support Compte Suspendu] ${subject || 'Aide d\'urgence'} : ${message.substring(0, 500)}`,
    });

    return NextResponse.json({ success: true, message: "Demande d'aide transmise avec succès" });
  } catch (error) {
    console.error("Support ticket creation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
