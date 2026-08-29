/**
 * Kobara — Mobile Login API Endpoint
 * 
 * POST /api/auth/mobile/login
 * 
 * Réutilise la MÊME logique de vérification que NextAuth :
 * - Vérifie email/password contre la table `users` (bcrypt)
 * - Vérifie que l'utilisateur est actif
 * - Récupère le profil marchand
 * - Retourne tokens JWT + profil
 * 
 * Ce n'est PAS un nouveau système d'auth — c'est un point d'entrée
 * mobile vers le même système existant.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import crypto from "crypto";
import { parseUserAgent } from "@/lib/utils/parse-user-agent";

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;
const MOBILE_TOKEN_SECRET = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_JWT_SECRET;

function hashSessionToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function getBrowserParts(browser: string) {
  const match = browser.match(/^(.*?)(?:\s+(\d[\d.]*))?$/);
  return {
    name: match?.[1]?.trim() || browser || "Kobara Mobile",
    version: match?.[2] || "",
  };
}

function getNormalizedDeviceType(device: string) {
  if (device === "Mobile") return "mobile";
  if (device === "Tablette") return "tablet";
  return "desktop";
}

export async function POST(req: NextRequest) {
  try {
    // Vérifier le header client
    const clientHeader = req.headers.get("X-Client");
    if (clientHeader !== "kobara-mobile") {
      return NextResponse.json(
        { error: "Client non autorisé.", code: "UNAUTHORIZED" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email et mot de passe requis.", code: "INVALID_CREDENTIALS" },
        { status: 400 }
      );
    }

    // Vérifier l'utilisateur (même logique que NextAuth authorize)
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, email, role, is_active, password_hash, email_verified")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (userError || !user) {
      console.error("Supabase user search error:", userError);
      return NextResponse.json(
        { error: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // Vérifier que le compte est actif
    if (user.is_active === false) {
      return NextResponse.json(
        { error: "Ce compte est désactivé. Contactez le support.", code: "ACCOUNT_INACTIVE" },
        { status: 403 }
      );
    }

    // Vérifier que l'email est vérifié
    if (user.email_verified === false) {
      return NextResponse.json(
        { error: "Veuillez vérifier votre adresse email avant de vous connecter.", code: "ACCOUNT_NOT_VERIFIED" },
        { status: 403 }
      );
    }

    // Comparer le hash bcrypt (même logique que NextAuth)
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" },
        { status: 401 }
      );
    }

    // Récupérer le profil marchand
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("id, user_id, business_name, business_slug, logo_url, email, phone, address, category, status, available_balance, pending_balance, currency")
      .eq("user_id", user.id)
      .single();

    // Déterminer si le profil est complet
    const merchantProfileComplete = merchant
      ? !!(merchant.phone && merchant.category)
      : false;

    // Générer les tokens
    if (!MOBILE_TOKEN_SECRET) {
      console.error("MOBILE_TOKEN_SECRET not configured");
      return NextResponse.json(
        { error: "Erreur de configuration serveur.", code: "SERVER_ERROR" },
        { status: 500 }
      );
    }

    const secret = new TextEncoder().encode(MOBILE_TOKEN_SECRET);
    const now = Math.floor(Date.now() / 1000);
    const refreshTokenId = crypto.randomUUID();
    const mobileSessionToken = hashSessionToken(refreshTokenId);

    // Access Token (courte durée — 1 heure)
    const accessToken = await new SignJWT({
      sub: user.id,
      email: user.email,
      role: user.role || "user",
      type: "access",
      platform: "mobile",
      sid: mobileSessionToken,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 3600) // 1 heure
      .sign(secret);

    // Refresh Token (longue durée — 30 jours)
    const refreshToken = await new SignJWT({
      sub: user.id,
      jti: refreshTokenId,
      type: "refresh",
      platform: "mobile",
      sid: mobileSessionToken,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(now + 30 * 24 * 3600) // 30 jours
      .sign(secret);

    if (merchant?.id) {
      const userAgent = req.headers.get("user-agent") || "kobara-mobile";
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
        || req.headers.get("x-real-ip")
        || "unknown";
      const { browser, os, device } = parseUserAgent(userAgent);
      const browserParts = getBrowserParts(browser);

      const { error: sessionError } = await supabaseAdmin
        .from("merchant_sessions")
        .upsert({
          merchant_id: merchant.id,
          session_token: mobileSessionToken,
          user_id: user.id,
          user_email: user.email,
          user_role: "owner",
          ip_address: ip,
          user_agent: userAgent,
          device_type: getNormalizedDeviceType(device),
          device_name: device === "Mobile" ? `Mobile ${os}` : `Application mobile ${os}`,
          browser: browserParts.name,
          browser_version: browserParts.version,
          operating_system: os,
          location: "Application mobile",
          login_method: "mobile-sso",
          status: "active",
          is_active: true,
          revoked_at: null,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          last_active_at: new Date().toISOString(),
        }, { onConflict: "session_token" });

      if (sessionError) {
        console.error("[MOBILE SESSION] Failed to record mobile session:", sessionError);
      }
    }

    // Log de l'audit (connexion mobile)
    try {
      await supabaseAdmin.from("audit_logs").insert({
        merchant_id: merchant?.id || null,
        action: "mobile_login",
        ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        user_agent: req.headers.get("user-agent") || "kobara-mobile",
        metadata: {
          user_id: user.id,
          platform: "mobile",
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // L'audit ne doit pas bloquer le login
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      merchant: merchant || null,
      accessToken,
      refreshToken,
      merchantProfileComplete,
    });
  } catch (error) {
    console.error("Mobile login error:", error);
    return NextResponse.json(
      { error: "Erreur serveur. Veuillez réessayer.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
