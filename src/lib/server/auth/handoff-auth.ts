import { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@/auth";

export async function authenticateHandoffToken(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    
    // Ignore API keys
    if (token.startsWith("kbr_sk_")) {
      return { merchantId: null, error: "Use API authentication for this endpoint" };
    }

    const supabaseAdmin = createAdminClient();
    
    const { data: profile, error } = await supabaseAdmin
      .from('kyc_profiles')
      .select('merchant_id, mobile_handoff_expires_at, mobile_handoff_completed')
      .eq('mobile_handoff_token', token)
      .single();

    if (error || !profile) {
      return { merchantId: null, error: "Token invalide ou introuvable" };
    }

    if (profile.mobile_handoff_completed) {
      return { merchantId: null, error: "Ce token a déjà été utilisé" };
    }

    const now = new Date();
    const expiresAt = new Date(profile.mobile_handoff_expires_at);
    if (now > expiresAt) {
      return { merchantId: null, error: "Ce token a expiré" };
    }

    return { merchantId: profile.merchant_id, error: null };
  }

  return { merchantId: null, error: "Token manquant" };
}

// Helper to check standard NextAuth session OR Handoff Token
export async function getKycMerchantId(request: NextRequest) {
  // 1. Try NextAuth Session
  const session = await auth() as any;
  if (session?.user?.id) {
    const supabase = createAdminClient();
    const { data: merchant } = await supabase.from('merchants').select('id').eq('user_id', session.user.id).single();
    if (merchant) return { merchantId: merchant.id, error: null };
  }

  // 2. Try Handoff Token
  return authenticateHandoffToken(request);
}
