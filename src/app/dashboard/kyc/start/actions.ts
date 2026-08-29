'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import crypto from "crypto";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function getAppOrigin() {
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || "https";

  if (!host) {
    return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || null;
  }

  const hostname = host.split(":")[0];
  const port = host.includes(":") ? `:${host.split(":")[1]}` : "";

  if (hostname === "dashboard.kobara.app" || hostname === "api.kobara.app" || hostname === "pay.kobara.app") {
    return "https://kobara.app";
  }

  if (hostname === "dashboard.localhost" || hostname === "api.localhost" || hostname === "pay.localhost") {
    return `http://localhost${port || ":3000"}`;
  }

  if (hostname === "dashboard.kobara.local" || hostname === "api.kobara.local" || hostname === "pay.kobara.local") {
    return `http://kobara.local${port}`;
  }

  return `${protocol}://${host}`;
}

export async function generateHandoffToken() {
  try {
    const { merchant } = await getCurrentUserAndMerchant();
    const supabase = createAdminClient();

    // Generate a secure token UUID
    const token = crypto.randomUUID();
    
    // Expires in 15 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    // Check if profile exists
    const { data: profile } = await supabase.from('kyc_profiles').select('id').eq('merchant_id', merchant.id).single();

    let dbError;
    if (profile) {
      const { error } = await supabase
        .from('kyc_profiles')
        .update({
          mobile_handoff_token: token,
          mobile_handoff_expires_at: expiresAt.toISOString(),
          mobile_handoff_completed: false
        })
        .eq('id', profile.id);
      dbError = error;
    } else {
      const { error } = await supabase
        .from('kyc_profiles')
        .insert({
          merchant_id: merchant.id,
          mobile_handoff_token: token,
          mobile_handoff_expires_at: expiresAt.toISOString(),
          mobile_handoff_completed: false
        });
      dbError = error;
    }

    if (dbError) {
      console.error("Failed to update kyc_profiles with handoff token:", dbError);
      return { error: "Erreur lors de la génération du lien." };
    }

    return { token };
  } catch (error: any) {
    console.error("generateHandoffToken error:", error);
    return { error: error.message || "Non autorisé" };
  }
}

export async function checkHandoffStatus() {
  try {
    const { merchant } = await getCurrentUserAndMerchant();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('kyc_profiles')
      .select('mobile_handoff_completed, mobile_handoff_expires_at')
      .eq('merchant_id', merchant.id)
      .single();

    if (error || !data) {
      return { completed: false };
    }

    // Check expiration just in case
    const now = new Date();
    const expiresAt = new Date(data.mobile_handoff_expires_at);
    const isExpired = now > expiresAt;

    if (isExpired && !data.mobile_handoff_completed) {
      return { expired: true, completed: false };
    }

    return { completed: !!data.mobile_handoff_completed };
  } catch (error) {
    return { completed: false };
  }
}

export async function sendKycHandoffLinkEmail(email: string, token: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return { error: "Adresse email invalide." };
    }

    if (!token) {
      return { error: "Lien mobile introuvable. Rechargez la page puis reessayez." };
    }

    const { merchant } = await getCurrentUserAndMerchant();
    const supabase = createAdminClient();

    const { data: profile, error } = await supabase
      .from('kyc_profiles')
      .select('mobile_handoff_expires_at, mobile_handoff_completed')
      .eq('merchant_id', merchant.id)
      .eq('mobile_handoff_token', token)
      .single();

    if (error || !profile) {
      return { error: "Lien mobile invalide ou expire." };
    }

    const expiresAt = new Date(profile.mobile_handoff_expires_at);
    if (profile.mobile_handoff_completed || new Date() > expiresAt) {
      return { error: "Ce lien mobile n'est plus valide. Rechargez la page." };
    }

    const origin = await getAppOrigin();
    if (!origin) {
      return { error: "Impossible de generer le lien mobile." };
    }

    const handoffUrl = `${origin}/kyc/mobile/${token}`;
    const { sendEmail } = await import("@/lib/server/mail");

    await sendEmail({
      to: normalizedEmail,
      subject: "Continuer la verification Kobara sur telephone",
      text: [
        "Bonjour,",
        "Vous avez demande a continuer votre verification d'identite Kobara sur telephone.",
        `Ouvrez ce lien depuis votre telephone : ${handoffUrl}`,
        "Le lien expire dans 15 minutes. Une fois la verification terminee sur telephone, votre ordinateur continuera automatiquement."
      ].join("\n\n"),
      html: `
        <p>Bonjour,</p>
        <p>Vous avez demande a continuer votre verification d'identite Kobara sur telephone.</p>
        <p style="text-align:center;margin:28px 0;">
          <a href="${handoffUrl}" style="background:#ff6b00;color:#ffffff;padding:14px 22px;border-radius:10px;text-decoration:none;font-weight:700;display:inline-block;">
            Continuer sur mon telephone
          </a>
        </p>
        <p>Ce lien expire dans 15 minutes. Une fois la verification terminee sur telephone, votre ordinateur continuera automatiquement.</p>
      `
    });

    return { success: true };
  } catch (error: any) {
    console.error("sendKycHandoffLinkEmail error:", error);
    return { error: error.message || "Erreur lors de l'envoi du lien." };
  }
}
