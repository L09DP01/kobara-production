import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { authLimiter, getClientIp } from "@/lib/server/security/rate-limit";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  
  const ip = getClientIp(request.headers);
  const { success } = await authLimiter.limit(`verify_email:${ip}`);
  if (!success) {
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Trop de tentatives. Veuillez réessayer plus tard.")}`);
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Jeton de validation manquant.")}`);
    }

    const supabase = createAdminClient();

    // Search user with this active token
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("verification_token", token)
      .maybeSingle();

    if (error || !user) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Jeton de validation invalide ou déjà utilisé.")}`);
    }

    // Check if token has expired
    const expiresAt = new Date(user.verification_token_expires).getTime();
    if (Date.now() > expiresAt) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Le lien de validation a expiré. Veuillez recréer votre compte.")}`);
    }

    // Verify user e-mail and clear tokens
    const { error: updateError } = await supabase
      .from("users")
      .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Impossible de valider votre compte. Veuillez réessayer.")}`);
    }

    // Successfully verified! Redirect to login with success message
    return NextResponse.redirect(`${appUrl}/login?success=${encodeURIComponent("Votre adresse e-mail a été validée avec succès ! Vous pouvez maintenant vous connecter.")}`);
    
  } catch (err: any) {
    console.error("Erreur critique lors de la vérification:", err);
    return NextResponse.redirect(`${appUrl}/login?error=${encodeURIComponent("Une erreur inattendue est survenue lors de la vérification de votre compte.")}`);
  }
}
