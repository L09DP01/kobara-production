import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";

// Workflow ID officiel Didit ("Free KYC")
const DIDIT_WORKFLOW_ID = "50c7c3ca-5bfc-43fe-92d6-6c1471020ace";

export async function POST(req: NextRequest) {
  try {
    const { merchant } = await getCurrentUserAndMerchant();
    if (!merchant) {
      return NextResponse.json({ error: "Non autorisé. Veuillez vous connecter." }, { status: 401 });
    }

    const apiKey = process.env.DIDIT_API_KEY;
    if (!apiKey) {
      console.error("[Didit KYC] DIDIT_API_KEY non configurée dans les variables d'environnement.");
      return NextResponse.json(
        { error: "Le service de vérification d'identité est en cours de configuration. Veuillez contacter le support." },
        { status: 503 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
    const callbackUrl = `${appUrl}/dashboard/kyc`;

    // Appel à l'API Didit v3 pour initialiser une session
    const diditRes = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: merchant.id,
        callback: callbackUrl,
        metadata: {
          merchant_id: merchant.id,
          business_name: merchant.business_name || '',
          email: merchant.email || '',
        },
      }),
    });

    if (!diditRes.ok) {
      const errorText = await diditRes.text().catch(() => '');
      console.error("[Didit KYC] Échec de création de session (status " + diditRes.status + "):", errorText);
      return NextResponse.json(
        { error: "Impossible d'initialiser la session de vérification d'identité.", detail: errorText },
        { status: 502 }
      );
    }

    const sessionData = await diditRes.json();
    const { url, session_id } = sessionData;

    // Enregistrer ou mettre à jour la session dans la base de données
    const supabase = createAdminClient();
    const { data: existingProfile } = await supabase
      .from('kyc_profiles')
      .select('id')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    if (existingProfile) {
      await supabase
        .from('kyc_profiles')
        .update({
          status: 'pending',
          gemini_review: { didit_session_id: session_id, didit_url: url },
          submitted_at: new Date().toISOString(),
        })
        .eq('id', existingProfile.id);
    } else {
      await supabase
        .from('kyc_profiles')
        .insert({
          merchant_id: merchant.id,
          status: 'pending',
          gemini_review: { didit_session_id: session_id, didit_url: url },
          submitted_at: new Date().toISOString(),
        });
    }

    // Mettre à jour le statut du marchand en cours de vérification
    await supabase
      .from('merchants')
      .update({ kyc_status: 'pending' })
      .eq('id', merchant.id);

    return NextResponse.json({
      success: true,
      url,
      session_id,
    });
  } catch (error: any) {
    console.error("[Didit KYC] Erreur inattendue:", error);
    return NextResponse.json({ error: "Une erreur est survenue lors de la création de la session." }, { status: 500 });
  }
}
