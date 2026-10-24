import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';

// All eligibility and activation writes are checked atomically by the database.
// An unavailable checker never grants access or replaces an existing decision.
export async function maybeActivateAdditionalBusiness<T extends Record<string, any>>(merchant: T): Promise<T> {
  if (!merchant.identity_owner_merchant_id || merchant.shopify_review_mode
    || merchant.business_verification_status !== 'pending' || !['pending','in_review'].includes(merchant.kyc_status)) return merchant;
  try {
    const db = createAdminClient();
    const result = await db.rpc('auto_activate_additional_business', { p_merchant_id: merchant.id, p_user_id: merchant.user_id });
    if (result.error) { console.error('[Business] Automatic activation unavailable', { code: result.error.code }); return merchant; }
    if (result.data !== true) return merchant;
    const fresh = await db.from('merchants').select('*').eq('id', merchant.id).eq('user_id', merchant.user_id).maybeSingle();
    return !fresh.error && fresh.data ? { ...merchant, ...fresh.data } : merchant;
  } catch {
    console.error('[Business] Automatic activation unavailable');
    return merchant;
  }
}
