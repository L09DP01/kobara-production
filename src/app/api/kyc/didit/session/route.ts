import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";

const DEFAULT_DIDIT_WORKFLOW_ID = "50c7c3ca-5bfc-43fe-92d6-6c1471020ace";
const DIDIT_SESSION_ENDPOINT = "https://verification.didit.me/v3/session/";

type DiditSessionResponse = {
  session_id?: unknown;
  url?: unknown;
};

function getProviderErrorDetail(rawBody: string) {
  try {
    const parsed = JSON.parse(rawBody) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : rawBody;
  } catch {
    return rawBody;
  }
}

function getClientError(status: number, detail: string) {
  const normalizedDetail = detail.toLowerCase();

  if (normalizedDetail.includes("enough credits")) {
    return {
      status: 503,
      code: "KYC_PROVIDER_CAPACITY",
      error: "Le service de vérification d'identité est temporairement indisponible. Veuillez réessayer plus tard.",
    };
  }

  if (status === 401 || status === 403) {
    return {
      status: 503,
      code: "KYC_PROVIDER_CONFIGURATION",
      error: "Le service de vérification d'identité est temporairement indisponible. Veuillez contacter le support.",
    };
  }

  return {
    status: 502,
    code: "KYC_SESSION_CREATION_FAILED",
    error: "Impossible d'initialiser la session de vérification d'identité. Veuillez réessayer.",
  };
}

export async function POST() {
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

    const workflowId = process.env.DIDIT_WORKFLOW_ID?.trim() || DEFAULT_DIDIT_WORKFLOW_ID;
    const dashboardUrl = (process.env.NEXT_PUBLIC_DASHBOARD_URL || "https://dashboard.kobara.app").replace(/\/+$/, "");
    const callbackUrl = `${dashboardUrl}/kyc`;

    // Appel à l'API Didit v3 pour initialiser une session
    const diditRes = await fetch(DIDIT_SESSION_ENDPOINT, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: workflowId,
        vendor_data: merchant.id,
        callback: callbackUrl,
        callback_method: "both",
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
      const clientError = getClientError(diditRes.status, getProviderErrorDetail(errorText));
      return NextResponse.json(
        { error: clientError.error, code: clientError.code },
        { status: clientError.status }
      );
    }

    const sessionData = await diditRes.json() as DiditSessionResponse;
    const { url, session_id } = sessionData;

    if (typeof url !== "string" || !url.startsWith("https://") || typeof session_id !== "string") {
      console.error("[Didit KYC] Réponse de création de session invalide.");
      return NextResponse.json(
        {
          error: "Le service de vérification a renvoyé une réponse invalide. Veuillez réessayer.",
          code: "KYC_PROVIDER_INVALID_RESPONSE",
        },
        { status: 502 }
      );
    }

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
  } catch (error: unknown) {
    console.error("[Didit KYC] Erreur inattendue:", error);
    return NextResponse.json({ error: "Une erreur est survenue lors de la création de la session." }, { status: 500 });
  }
}
