import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';

export const SHOPIFY_NAVIGATION_KEY = 'shopify_navigation';

export async function getShopifyNavigationHidden(): Promise<boolean | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('system_settings').select('value')
      .eq('key', SHOPIFY_NAVIGATION_KEY).maybeSingle();
    if (error) return null;
    return data?.value?.hidden === true;
  } catch {
    return null;
  }
}
