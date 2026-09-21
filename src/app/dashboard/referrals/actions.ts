'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';
import { createPartnerToken } from '@/lib/server/partners/tokens';
import { sendMerchantReferralInvitation } from '@/lib/server/partners/mail';

const RESERVED_CODES = new Set([
  'admin', 'api', 'app', 'dashboard', 'developer', 'docs', 'help', 'invite',
  'kobara', 'login', 'pay', 'register', 'support', 'system', 'withdrawals',
]);

function normalizeReferralCode(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export async function updateMerchantReferralCode(value: string) {
  const session = await auth();
  const { merchant, userRole } = await getCurrentUserAndMerchant();
  if (!session?.user?.id || userRole !== 'owner' || merchant.user_id !== session.user.id) {
    return { error: 'Seul le propriétaire peut modifier ce lien.' };
  }

  const code = normalizeReferralCode(value);
  if (code.length < 3 || RESERVED_CODES.has(code)) {
    return { error: 'Choisissez une référence de 3 à 40 caractères.' };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('merchants').update({ referral_code: code })
    .eq('id', merchant.id).eq('user_id', session.user.id);
  if (error) {
    return { error: error.code === '23505' ? 'Cette référence est déjà utilisée.' : 'Impossible de modifier le lien pour le moment.' };
  }

  revalidatePath('/dashboard', 'layout');
  revalidatePath('/dashboard/referrals');
  return { success: true, code };
}

export async function inviteMerchantFriend(formData: FormData) {
  const { merchant, userRole } = await getCurrentUserAndMerchant();
  if (userRole !== 'owner') return { error: 'Seul le propriétaire peut envoyer une invitation.' };

  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Adresse e-mail invalide.' };
  if (email === String(merchant.email).toLowerCase()) return { error: 'Vous ne pouvez pas vous inviter vous-même.' };

  const supabase = createAdminClient();
  const { raw, hash } = createPartnerToken();
  const { data, error } = await supabase.from('merchant_referrals').insert({
    referrer_merchant_id: merchant.id,
    invited_email: email,
    token_hash: hash,
    reward_currency: 'HTG',
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'Une invitation active existe déjà.' : "Impossible de créer l'invitation." };

  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  const sent = await sendMerchantReferralInvitation({ to: email, merchantName: merchant.business_name, url: `${base}/referrals/accept/${raw}` });
  if (!sent.success) {
    await supabase.from('merchant_referrals').delete().eq('id', data.id);
    return { error: "L'e-mail n'a pas pu être envoyé." };
  }

  revalidatePath('/dashboard/referrals');
  revalidatePath('/dashboard', 'layout');
  return { success: true };
}
