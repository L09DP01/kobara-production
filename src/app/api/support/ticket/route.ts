import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createSupportConversation } from "@/lib/server/support/tickets";

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

    const result = await createSupportConversation({
      merchantId: merchant?.id,
      requesterName: merchant?.business_name || user?.user_metadata?.full_name,
      requesterEmail: merchant?.email || user?.email || '',
      recipientEmail: 'support@kobara.app',
      subject: subject || "Aide d'urgence",
      category,
      priority,
      message,
      source: 'suspended_account',
    });

    return NextResponse.json({
      success: true,
      message: "Demande d'aide transmise avec succès",
      reference: result.publicId,
    });
  } catch (error) {
    console.error("Support ticket creation error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
