import 'server-only';
import { auth } from '@/auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { selectAccountSecurityRow } from '@/lib/account-settings-policy';

export async function getOwnedAccountMerchants(userId: string) {
  const { data, error } = await createAdminClient().from('merchants').select('*')
    .eq('user_id', userId).order('created_at').order('id');
  if (error) throw new Error('account_settings_lookup_failed');
  return data || [];
}

export async function getAccountSecurity(userId: string) {
  const merchants = await getOwnedAccountMerchants(userId);
  if (!merchants.length) throw new Error('account_settings_unavailable');
  const ids = merchants.map(merchant => merchant.id);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('settings').select('merchant_id,security_json').in('merchant_id', ids);
  if (error) throw new Error('account_security_lookup_failed');
  const row = selectAccountSecurityRow(data || [], ids, userId);
  const merchant = merchants.find(item => item.id === row?.merchant_id) || merchants[0];
  const security = { ...(row?.security_json || {}), account_user_id: userId };
  if (row?.security_json?.account_user_id !== userId) {
    const keys = new Map<string, any>();
    for (const item of data || []) {
      for (const key of item.security_json?.passkeys || []) {
        if (!keys.has(key.id) || Number(key.counter || 0) > Number(keys.get(key.id).counter || 0)) keys.set(key.id, key);
      }
    }
    security.passkeys = [...keys.values()];
  }
  return { merchant, security, supabase };
}

export async function getCurrentAccountSecurity() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Non autorise');
  return { user: session.user, ...await getAccountSecurity(session.user.id) };
}

export async function getAccountTelegramLink(userId: string) {
  const merchants = await getOwnedAccountMerchants(userId);
  if (!merchants.length) return null;
  const { data, error } = await createAdminClient().from('merchant_telegram_accounts').select('*')
    .in('merchant_id', merchants.map(item => item.id)).order('linked_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('account_telegram_lookup_failed');
  return data;
}

export async function getMerchantAccountTelegramLink(merchantId: string) {
  const { data, error } = await createAdminClient().from('merchants').select('user_id').eq('id', merchantId).maybeSingle();
  if (error) throw new Error('account_telegram_owner_lookup_failed');
  return data ? getAccountTelegramLink(data.user_id) : null;
}
