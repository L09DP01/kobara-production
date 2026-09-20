import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ApiKeySecurity } from "@/lib/server/security/api-keys";
import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";

export type ApiKeyScope = 'payments:create' | 'payments:read' | 'withdrawals:create';

type ApiAuthOptions = {
  requiredScope?: ApiKeyScope;
};

export async function authenticateApiRequest(request: NextRequest, options: ApiAuthOptions = {}) {
  const authHeader = request.headers.get("Authorization");
  
  if (authHeader && authHeader.startsWith("Bearer kbr_sk_")) {
    const apiKey = authHeader.replace("Bearer ", "");
    const keyHash = ApiKeySecurity.hashKey(apiKey);
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (supabaseServiceKey) {
      const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
        cookies: {
          getAll() { return [] },
          setAll() { }
        }
      });
      
      const { data: keyRecord, error: keyError } = await supabaseAdmin
        .from('api_keys')
        .select('id, merchant_id, environment, revoked_at, created_by_type, developer_id, developer_connection_id, scopes')
        .eq('key_hash', keyHash)
        .single();

      if (keyError || !keyRecord) {
        return { merchantId: null, error: "Invalid API Key" };
      }

      if (keyRecord.revoked_at) {
        return { merchantId: null, error: "API Key has been revoked" };
      }

      if (keyRecord.environment !== 'live') {
        return { merchantId: null, error: "Sandbox keys are not accepted by the Production API" };
      }

      const scopes = Array.isArray(keyRecord.scopes) ? keyRecord.scopes : [];
      if (options.requiredScope && !scopes.includes(options.requiredScope)) {
        return {
          merchantId: null,
          error: "Cette clé API ne possède pas la permission requise.",
          errorCode: 'INSUFFICIENT_API_KEY_SCOPE',
          forbidden: true,
        };
      }

      if (keyRecord.created_by_type === 'developer') {
        if (!keyRecord.developer_id || !keyRecord.developer_connection_id) {
          return { merchantId: null, error: "Developer API key is not linked to an active connection" };
        }

        const [{ data: connection }, { data: developer }] = await Promise.all([
          supabaseAdmin
            .from('developer_merchant_connections')
            .select('merchant_id, status, withdrawal_access')
            .eq('id', keyRecord.developer_connection_id)
            .eq('developer_id', keyRecord.developer_id)
            .maybeSingle(),
          supabaseAdmin
            .from('developer_accounts')
            .select('status')
            .eq('id', keyRecord.developer_id)
            .maybeSingle(),
        ]);

        if (
          developer?.status !== 'active'
          ||
          !connection
          || connection.merchant_id !== keyRecord.merchant_id
          || !['connected', 'integration', 'live'].includes(connection.status)
        ) {
          return {
            merchantId: null,
            error: "La connexion entre le développeur et le marchand n'est plus active.",
            errorCode: 'DEVELOPER_CONNECTION_INACTIVE',
            forbidden: true,
          };
        }

        if (options.requiredScope === 'withdrawals:create' && !connection.withdrawal_access) {
          return {
            merchantId: null,
            error: "Le marchand n'a pas autorisé les retraits pour ce développeur.",
            errorCode: 'DEVELOPER_WITHDRAWAL_ACCESS_REQUIRED',
            forbidden: true,
          };
        }
      }

      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('kyc_status, status, account_access')
        .eq('id', keyRecord.merchant_id)
        .maybeSingle();

      if (!merchant || merchant.kyc_status !== 'approved') {
        return { merchantId: null, error: "KYC approval is required" };
      }

      if (merchant.status === 'suspended' || ['suspended', 'permanently_closed'].includes(merchant.account_access || '')) {
        return { merchantId: null, error: "Merchant account is not active" };
      }

      // Update last used timestamp (non-blocking)
      supabaseAdmin
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('key_hash', keyHash)
        .then(({ error }) => {
          if (error) console.error("Failed to update API key last_used_at:", error);
        });

      return { 
        merchantId: keyRecord.merchant_id, 
        environment: 'live' as const,
        apiKeyId: keyRecord.id,
        apiKeyOrigin: keyRecord.created_by_type as 'merchant' | 'developer' | 'system',
        apiKeyScopes: scopes as ApiKeyScope[],
        developerId: keyRecord.developer_id as string | null,
        developerConnectionId: keyRecord.developer_connection_id as string | null,
        error: null 
      };
    }
  }

  // Fallback to NextAuth session (for internal dashboard use)
  const session = await auth();
  const user = session?.user;

  if (user?.id) {
    const supabaseAdmin = createAdminClient();
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, kyc_status, status, account_access')
      .eq('user_id', user.id)
      .single();
      
    if (merchant?.kyc_status === 'approved' && merchant.status !== 'suspended' && !['suspended', 'permanently_closed'].includes(merchant.account_access || '')) {
      return {
        merchantId: merchant.id,
        environment: 'live' as const,
        apiKeyId: null,
        apiKeyOrigin: 'system' as const,
        apiKeyScopes: [] as ApiKeyScope[],
        developerId: null,
        developerConnectionId: null,
        error: null,
      };
    }
  }

  return { merchantId: null, error: "Unauthorized" };
}
