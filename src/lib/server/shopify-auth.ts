import 'server-only';

import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';

export async function requireShopifyOwnerMerchant() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) throw new Error('unauthorized');

  const supabase = createAdminClient();
  const activeMerchantId = (await cookies()).get('kobara_active_merchant')?.value;
  let query = supabase
    .from('merchants')
    .select('id, user_id, business_name, email, kyc_status, current_environment')
    .eq('user_id', userId);
  if (activeMerchantId) query = query.eq('id', activeMerchantId);
  const { data: merchant, error } = await query.maybeSingle();
  if (error || !merchant) throw new Error('owner_required');
  return { session, merchant, supabase };
}
