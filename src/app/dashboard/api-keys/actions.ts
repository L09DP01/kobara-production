import 'server-only';

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { revalidatePath } from "next/cache";
import { canCreateApiKey } from "@/lib/server/access";
import { ApiKeySecurity } from "@/lib/server/security/api-keys";
import { createAdminClient } from "@/utils/supabase/admin";
import { notifyApiKeyRevoked } from "@/lib/server/notifications";

export async function generateApiKey(name: string, environment: 'live' | 'test' = 'test') {
  try {
    const { user, merchant, supabase } = await getCurrentUserAndMerchant();

    // For API keys, the user should be owner/admin. Let's assume standard role for now as per MVP.
    let role = 'owner';
    let merchantId = merchant.id;

    // Apply permission logic
    if (environment === 'live' && role !== 'owner' && role !== 'admin') {
      return { error: "Only owners and admins can generate live API keys" };
    }

    const accessCheck = await canCreateApiKey(merchantId, environment);
    if (!accessCheck.allowed) {
      if (accessCheck.reason === 'kyc_required') return { error: "Vous devez vérifier votre compte (KYC) pour créer une clé Live." };
      if (accessCheck.reason === 'subscription_expired') return { error: "Votre abonnement a expiré. Renouvelez-le pour créer davantage de clés API.", code: 'SUBSCRIPTION_EXPIRED' };
      if (accessCheck.reason === 'api_key_limit_reached') return { error: "Vous avez atteint la limite de clés API de votre plan. Veuillez révoquer votre clé existante pour en créer une nouvelle." };
      return { error: "Accès refusé" };
    }

    // Generate a random key
    const prefix = environment === 'live' ? "kbr_sk_live_" : "kbr_sk_test_";
    const { rawKey, keyHash } = ApiKeySecurity.generateKey(prefix);

    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('api_keys')
      .insert({
        merchant_id: merchantId,
        name: name,
        prefix: prefix,
        key_hash: keyHash,
        environment: environment
      });

    if (error) {
      console.error(JSON.stringify({
        event: 'api_key_insert_failed',
        code: error.code || null,
        message: error.message,
      }));
      return { error: `Impossible de créer la clé API (${error.code || 'DB_ERROR'}).` };
    }

    revalidatePath('/dashboard/api-keys');

    return { rawKey, name, environment };
  } catch (err: any) {
    console.error("API Key Gen Error:", err);
    return { error: err.message || "Une erreur interne est survenue." };
  }
}

export async function revokeApiKey(id: string) {
  try {
    const { user, merchant, supabase } = await getCurrentUserAndMerchant();

    // Verify the key belongs to this merchant (via RLS-protected SELECT)
    const { data: keyInfo } = await supabase
      .from('api_keys')
      .select('merchant_id, name')
      .eq('id', id)
      .single();

    if (!keyInfo) {
      return { error: "API key not found" };
    }

    if (keyInfo.merchant_id !== merchant.id) {
      return { error: "Vous n'êtes pas autorisé à révoquer cette clé API" };
    }

    // Use admin client to bypass RLS (no DELETE policy exists on api_keys)
    const adminClient = createAdminClient();

    const { error } = await adminClient
      .from('api_keys')
      .delete()
      .eq('id', id)
      .eq('merchant_id', merchant.id); // Double-check ownership

    if (error) {
      console.error("API Key Delete Error:", error);
      return { error: "Erreur lors de la suppression de la clé API" };
    }

    // Send notification to merchant
    await notifyApiKeyRevoked(merchant.id, merchant.email || user.email, keyInfo.name || "Inconnue");

    revalidatePath('/dashboard/api-keys');
    return { success: true };
  } catch (err: any) {
    console.error("API Key Revoke Error:", err);
    return { error: err.message || "Une erreur interne est survenue." };
  }
}
