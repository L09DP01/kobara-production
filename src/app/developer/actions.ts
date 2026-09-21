'use server';

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { verifyTurnstileToken } from '@/lib/server/security/turnstile';
import { requirePartner } from '@/lib/server/partners/auth';
import { createPartnerToken, encryptPartnerDestination, maskDestination } from '@/lib/server/partners/tokens';
import { sendDeveloperMerchantInvitation } from '@/lib/server/partners/mail';
import { ApiKeySecurity } from '@/lib/server/security/api-keys';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerDeveloper(formData: FormData) {
  const firstName = String(formData.get('first_name') || '').trim();
  const lastName = String(formData.get('last_name') || '').trim();
  const companyName = String(formData.get('company_name') || '').trim();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const password = String(formData.get('password') || '');
  const phone = String(formData.get('phone') || '').trim();
  const websiteUrl = String(formData.get('website_url') || '').trim();
  const turnstile = String(formData.get('cf-turnstile-response') || formData.get('turnstile_token') || '');
  const human = await verifyTurnstileToken(turnstile);
  if (!human.success) return { error: human.error || 'Vérification humaine requise.' };
  if (!firstName || !lastName || !EMAIL_RE.test(email) || password.length < 8) {
    return { error: 'Complétez les champs requis avec un mot de passe de 8 caractères minimum.' };
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from('users').select('id, role, password_hash').ilike('email', email).maybeSingle();
  if (existing) {
    const { data: existingDeveloper } = await supabase.from('developer_accounts').select('id').eq('user_id', existing.id).maybeSingle();
    if (existingDeveloper) return { error: 'Un compte Developer existe déjà. Connectez-vous avec cette adresse.' };
    if (!existing.password_hash) return { error: 'Ce compte Kobara ne peut pas être vérifié avec un mot de passe.' };
    const passwordMatches = await bcrypt.compare(password, existing.password_hash);
    if (!passwordMatches) return { error: 'Cette adresse possède déjà un compte Kobara. Saisissez le mot de passe de ce compte.' };
  }

  const userId = existing?.id || crypto.randomUUID();
  let createdUser = false;
  const referralCode = `DEV${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    const { error: userError } = await supabase.from('users').insert({
      id: userId, email, password_hash: passwordHash, email_verified: true, role: 'developer', is_active: true,
    });
    if (userError) {
      console.error('Developer account user creation failed:', { code: userError.code, message: userError.message });
      return { error: userError.code === '23505' ? 'Un compte existe déjà avec cette adresse e-mail.' : `Impossible de créer le compte Developer (${userError.code || 'DB_ERROR'}).` };
    }
    createdUser = true;
  }

  const { error: developerError } = await supabase.from('developer_accounts').insert({
    user_id: userId,
    display_name: `${firstName} ${lastName}`,
    company_name: companyName || null,
    phone: phone || null,
    website_url: websiteUrl || null,
    referral_code: referralCode,
    status: 'pending',
  });
  if (developerError) {
    if (createdUser) await supabase.from('users').delete().eq('id', userId);
    console.error('Developer profile creation failed:', { code: developerError.code, message: developerError.message });
    return { error: `Impossible de créer le profil Developer (${developerError.code || 'DB_ERROR'}).` };
  }

  await supabase.from('partner_applications').insert({
    program_type: 'developer', first_name: firstName, last_name: lastName, email, phone: phone || null,
    company_name: companyName || null, website_or_social: websiteUrl || null, status: 'new',
  });
  return { success: true };
}

export async function inviteDeveloperClient(formData: FormData) {
  const { account, supabase } = await requirePartner('developer');
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: 'Adresse e-mail invalide.' };
  const { raw, hash } = createPartnerToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  const { data: invitation, error } = await supabase.from('developer_invitations').insert({
    developer_id: account.id, invited_email: email, token_hash: hash, expires_at: expiresAt,
  }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'Une invitation active existe déjà pour cet e-mail.' : "Impossible de créer l'invitation." };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://dashboard.kobara.app';
  const url = `${baseUrl}/developer/invitations/${raw}`;
  const sent = await sendDeveloperMerchantInvitation({ to: email, developerName: account.company_name || account.display_name, url });
  if (!sent.success) {
    await supabase.from('developer_invitations').delete().eq('id', invitation.id);
    return { error: "L'invitation n'a pas pu être envoyée." };
  }
  revalidatePath('/developer/portal/referrals');
  return { success: true };
}

export async function createDeveloperApiKey(formData: FormData) {
  const { account, user, supabase } = await requirePartner('developer');
  const connectionId = String(formData.get('connection_id') || '');
  const name = String(formData.get('name') || 'Clé Developer').trim().slice(0, 80);
  const requestWithdrawals = formData.get('withdrawals') === 'true';
  const { data: connection } = await supabase.from('developer_merchant_connections')
    .select('id, merchant_id, status, withdrawal_access')
    .eq('id', connectionId).eq('developer_id', account.id).maybeSingle();
  if (!connection || connection.status === 'revoked') return { error: 'Client non disponible.' };
  if (requestWithdrawals && !connection.withdrawal_access) return { error: "Le marchand n'a pas autorisé les retraits." };

  const scopes = requestWithdrawals ? ['payments:create', 'withdrawals:create'] : ['payments:create'];
  const prefix = 'kbr_sk_live_';
  const { rawKey, keyHash } = ApiKeySecurity.generateKey(prefix);
  const { error } = await supabase.from('api_keys').insert({
    merchant_id: connection.merchant_id, name, prefix, key_hash: keyHash, environment: 'live',
    created_by_type: 'developer', created_by_user_id: user.id, developer_id: account.id,
    developer_connection_id: connection.id, scopes,
  });
  if (error) return { error: 'Impossible de créer la clé API.' };
  revalidatePath(`/developer/portal/clients/${connection.id}`);
  return { success: true, rawKey };
}

export async function requestPartnerWithdrawal(formData: FormData) {
  const { account, supabase } = await requirePartner('developer');
  const amount = Number(formData.get('amount'));
  const currency = String(formData.get('currency') || '').toUpperCase();
  const destinationType = String(formData.get('destination_type') || 'bank').trim();
  const destination = String(formData.get('destination') || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !['HTG', 'USD'].includes(currency) || destination.length < 5) {
    return { error: 'Informations de retrait invalides.' };
  }
  const { error } = await supabase.rpc('request_partner_withdrawal', {
    p_beneficiary_type: 'developer', p_beneficiary_id: account.id, p_amount: amount,
    p_currency: currency, p_destination_type: destinationType,
    p_destination_masked: maskDestination(destination), p_destination_encrypted: encryptPartnerDestination(destination),
    p_idempotency_key: `developer:${account.id}:${crypto.randomUUID()}`,
  });
  if (error) return { error: error.message.includes('insufficient') ? 'Solde disponible insuffisant.' : 'Impossible de créer ce retrait.' };
  revalidatePath('/developer/portal/referrals');
  return { success: true };
}
