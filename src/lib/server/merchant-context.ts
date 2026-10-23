import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';

export const MERCHANT_CONTEXT_COOKIE = 'kobara_active_merchant';
export const MERCHANT_CONTEXT_HEADER = 'x-kobara-merchant-id';
export const isMerchantId = (value: unknown): value is string => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function getAccessibleMerchants(userId: string) {
  const db = createAdminClient();
  const owned = await db.from('merchants').select('*').eq('user_id', userId).order('created_at').order('id');
  if (owned.error) throw new Error('merchant_lookup_failed');
  const memberships = await db.from('merchant_members').select('role, merchants(*)')
    .eq('user_id', userId).eq('status', 'active').order('created_at');
  if (memberships.error) throw new Error('membership_lookup_failed');
  const merchants = new Map<string, any>();
  for (const merchant of owned.data || []) merchants.set(merchant.id, { ...merchant, role: 'owner' });
  for (const membership of memberships.data || []) {
    const merchant = membership.merchants as any;
    if (merchant?.id && !merchants.has(merchant.id)) merchants.set(merchant.id, { ...merchant, role: membership.role === 'admin' ? 'admin' : 'developer' });
  }
  return [...merchants.values()];
}

export async function resolveMerchantContext(userId: string, selectedId?: string | null, ownerOnly = false) {
  const accessible = await getAccessibleMerchants(userId);
  const candidates = ownerOnly ? accessible.filter(m => m.role === 'owner' && m.user_id === userId) : accessible;
  // An explicit unknown selection must never silently target another business.
  const merchant = selectedId ? candidates.find(m => m.id === selectedId.toLowerCase()) : candidates[0];
  return { merchant: merchant || null, accessibleMerchants: accessible, userRole: merchant?.role || null };
}

export function merchantSwitcherOptions(merchants: any[]) {
  return merchants.map(m => ({ id: m.id, business_name: m.business_name, logo_url: m.logo_url,
    role: m.role, current_environment: m.current_environment, kyc_status: m.kyc_status,
    shopify_review_mode: m.shopify_review_mode === true }));
}
