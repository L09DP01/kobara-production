import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authLimiter, getClientIp } from "@/lib/server/security/rate-limit";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await authLimiter.limit(`mobile_sso:${ip}`);
  if (!success) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Trop de tentatives SSO. Veuillez réessayer plus tard.")}`, req.url));
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("access_token");
  const next = url.searchParams.get("next") || "/dashboard";

  if (!token) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Jeton d'authentification manquant.")}`, req.url));
  }

  const MOBILE_TOKEN_SECRET = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_JWT_SECRET;
  
  if (!MOBILE_TOKEN_SECRET) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Erreur de configuration serveur.")}`, req.url));
  }

  const secret = new TextEncoder().encode(MOBILE_TOKEN_SECRET);

  try {
    // 1. Validate the mobile JWT
    const { payload } = await jwtVerify(token, secret);
    
    if (!payload.email) {
      throw new Error("No email in token payload");
    }

    const email = payload.email as string;

    // 2. Generate Supabase magic link
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
    });

    if (error || !data?.properties?.hashed_token) {
      console.error("Error generating magic link:", error);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Impossible de générer le lien de connexion.")}`, req.url));
    }

    // 3. Redirect the user to our OWN callback route using the hashed_token
    // This avoids hitting the Supabase hosted URL which redirects to localhost
    const tokenHash = data.properties.hashed_token;
    const type = data.properties.verification_type || "magiclink";
    
    // Construct the callback URL
    const callbackUrl = new URL("/api/auth/callback", req.url);
    callbackUrl.searchParams.set("token_hash", tokenHash);
    callbackUrl.searchParams.set("type", type);
    callbackUrl.searchParams.set("next", next);

    return NextResponse.redirect(callbackUrl.toString());
  } catch (error) {
    console.error("SSO Verification error:", error);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("Jeton d'authentification invalide ou expiré.")}`, req.url));
  }
}
