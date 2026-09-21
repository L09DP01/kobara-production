import 'server-only';

import { auth } from '@/auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';

export type PartnerRole = 'developer' | 'ambassador';

export async function getPartnerSession(role: PartnerRole, options: { activeOnly?: boolean } = {}) {
  const session = await auth();
  const user = session?.user as { id?: string; email?: string | null; role?: string } | undefined;
  if (!user?.id) return null;

  const supabase = createAdminClient();
  const table = role === 'developer' ? 'developer_accounts' : 'ambassador_accounts';
  const { data: account, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !account) return null;
  if (options.activeOnly && account.status !== 'active') return null;
  return { session, user, account, supabase };
}

export async function requirePartner(role: PartnerRole, options: { activeOnly?: boolean } = { activeOnly: true }) {
  const result = await getPartnerSession(role, options);
  if (!result) redirect(`/${role}/login`);
  if (options.activeOnly !== false && result.account.status !== 'active') redirect(`/${role}/status`);
  return result;
}
