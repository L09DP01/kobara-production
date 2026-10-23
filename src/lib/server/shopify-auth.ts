import 'server-only';

import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { resolveMerchantContext } from '@/lib/server/merchant-context';

export async function requireShopifyOwnerMerchant() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('unauthorized');

  const supabase = createAdminClient();
  const activeMerchantId = (await cookies()).get('kobara_active_merchant')?.value;
  const { merchant } = await resolveMerchantContext(userId, activeMerchantId, true);
  if (!merchant) throw new Error('owner_required');
  const { id, user_id, business_name, email, kyc_status, current_environment } = merchant;
  return { session, merchant: { id, user_id, business_name, email, kyc_status, current_environment }, supabase };
}
