'use server'

import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getCurrentUserAndMerchant as getAuthUserAndMerchant } from "@/utils/supabase/auth-helper";
import { 
  notifyPasswordChange, 
  notify2faActivation, 
  notifyPlanActivation 
} from "@/lib/server/notifications";
import {
  BUSINESS_NAME_TAKEN_MESSAGE,
  getBusinessNameValidationError,
  isBusinessNameConflict,
  normalizeBusinessName,
} from "@/lib/business-name";
import { normalizeSixDigitCode } from '@/lib/two-factor';

export async function updatePayoutSettings(savedMoncashNumber: string) {
  const { merchant } = await getAuthUserAndMerchant();

  const { data: currentSettings } = await createAdminClient().from('settings')
    .select('settings_json')
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  const generalSettings = currentSettings?.settings_json || {};
  generalSettings.saved_moncash_number = savedMoncashNumber;

  const adminClient = createAdminClient();

  if (currentSettings) {
    const { error } = await adminClient
      .from('settings')
      .update({ settings_json: generalSettings })
      .eq('merchant_id', merchant.id);

    if (error) {
      throw new Error("Erreur lors de la mise à jour des paramètres de retrait");
    }
  } else {
    const { error } = await adminClient
      .from('settings')
      .insert({
        merchant_id: merchant.id,
        settings_json: generalSettings,
        security_json: { two_factor_method: 'none' },
        transaction_fee_percent: 2.9,
        settlement_method: 'manual'
      });

    if (error) {
      throw new Error("Erreur lors de la création des paramètres de retrait");
    }
  }

  revalidatePath('/dashboard/settings');
  revalidatePath('/dashboard/withdrawals');
}

export async function updateMerchantProfile(formData: {
  business_name: string;
  category: string;
  email: string;
  phone: string;
  first_name?: string;
  last_name?: string;
  logo_url?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipcode?: string;
}) {
  const { user, merchant } = await getAuthUserAndMerchant();
  const businessName = normalizeBusinessName(formData.business_name);
  const businessNameError = getBusinessNameValidationError(businessName);
  if (businessNameError) throw new Error(businessNameError);

  // 1. Update merchants table
  const { error: merchantError } = await createAdminClient().from('merchants')
    .update({
      business_name: businessName,
      category: formData.category,
      email: formData.email,
      phone: formData.phone,
      logo_url: formData.logo_url !== undefined ? formData.logo_url : merchant.logo_url,
      address: JSON.stringify({
        address: formData.address || '',
        city: formData.city || '',
        state: formData.state || '',
        country: formData.country || '',
        zipcode: formData.zipcode || ''
      })
    })
    .eq('id', merchant.id);

  if (merchantError) {
    if (isBusinessNameConflict(merchantError)) throw new Error(BUSINESS_NAME_TAKEN_MESSAGE);
    throw new Error("Erreur lors de la mise à jour du profil: " + merchantError.message);
  }

  // 2. Update users table if names are provided
  if (formData.first_name !== undefined || formData.last_name !== undefined) {
    const { error: userError } = await createAdminClient().from('users')
      .update({
        first_name: formData.first_name || '',
        last_name: formData.last_name || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (userError) throw new Error("Erreur lors de la mise à jour des informations personnelles: " + userError.message);
  }

  revalidatePath('/dashboard/settings');
}

export async function updateNotificationSettings(notificationsJson: any) {
  const { merchant } = await getAuthUserAndMerchant();

  const { error } = await createAdminClient().from('settings')
    .update({ notifications_json: notificationsJson })
    .eq('merchant_id', merchant.id);

  if (error) throw new Error("Failed to update notification settings");
  revalidatePath('/dashboard/settings');
}

export async function inviteTeamMember(email: string, role: string = 'developer') {
  const { merchant, userRole } = await getAuthUserAndMerchant();
  if (userRole !== 'owner') {
    throw new Error("Seul le propriétaire de l'entreprise peut inviter des membres.");
  }

  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) throw new Error("Adresse e-mail invalide.");

  const supabase = createAdminClient();

  // Check if owner's email
  const { data: ownerUser } = await supabase.from('users').select('email').eq('id', merchant.user_id).single();
  if (ownerUser?.email?.toLowerCase() === cleanEmail) {
    throw new Error("Le propriétaire de l'entreprise fait déjà partie de l'équipe.");
  }

  // Check existing membership
  const { data: existing } = await supabase
    .from('merchant_members')
    .select('id, status')
    .eq('merchant_id', merchant.id)
    .eq('email', cleanEmail)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'active') {
      throw new Error("Cet utilisateur est déjà un membre actif de l'équipe.");
    } else {
      throw new Error("Une invitation est déjà en attente pour cet e-mail. Vous pouvez utiliser 'Renvoyer'.");
    }
  }

  const { data: newMember, error } = await supabase
    .from('merchant_members')
    .insert({
      merchant_id: merchant.id,
      email: cleanEmail,
      role: role || 'developer',
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) throw new Error("Erreur lors de la création de l'invitation: " + error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  const inviteLink = `${appUrl}/invite?token=${newMember.id}`;

  const { sendTeamInviteEmail } = await import('@/lib/server/mail');
  await sendTeamInviteEmail({
    to: cleanEmail,
    businessName: merchant.business_name || 'Kobara',
    inviteLink,
    role: role || 'developer'
  });

  revalidatePath('/dashboard/settings');
  return { success: true, memberId: newMember.id };
}

export async function removeTeamMember(memberId: string) {
  const { merchant, userRole } = await getAuthUserAndMerchant();
  if (userRole !== 'owner') {
    throw new Error("Seul le propriétaire peut retirer un membre de l'équipe.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('merchant_members')
    .delete()
    .eq('id', memberId)
    .eq('merchant_id', merchant.id);

  if (error) throw new Error("Erreur lors de la suppression du membre.");
  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function resendTeamInvite(memberId: string) {
  const { merchant, userRole } = await getAuthUserAndMerchant();
  if (userRole !== 'owner') {
    throw new Error("Seul le propriétaire peut renvoyer une invitation.");
  }

  const supabase = createAdminClient();
  const { data: member, error } = await supabase
    .from('merchant_members')
    .select('id, email, role, status')
    .eq('id', memberId)
    .eq('merchant_id', merchant.id)
    .single();

  if (error || !member) throw new Error("Membre introuvable.");
  if (member.status !== 'pending') throw new Error("Ce membre a déjà accepté l'invitation.");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  const inviteLink = `${appUrl}/invite?token=${member.id}`;

  const { sendTeamInviteEmail } = await import('@/lib/server/mail');
  await sendTeamInviteEmail({
    to: member.email,
    businessName: merchant.business_name || 'Kobara',
    inviteLink,
    role: member.role || 'developer'
  });

  return { success: true };
}

export async function updatePassword(password: string) {
  const session = await auth();
  const user = session?.user as any;
  if (!user) {
    throw new Error("Non autorisé");
  }

  if (password.length < 6) {
    throw new Error("Le mot de passe doit comporter au moins 6 caractères.");
  }

  const supabase = createAdminClient();
  const passwordHash = await bcrypt.hash(password, 10);

  const { error } = await supabase.from('users')
    .update({ password_hash: passwordHash })
    .eq('id', user.id);

  if (error) {
    throw new Error("Erreur lors de la mise à jour du mot de passe: " + error.message);
  }

  try {
    const { data: mData } = await supabase.from('merchants').select('id').eq('user_id', user.id).single();
    if (mData) {
      await notifyPasswordChange(mData.id, user.email);
    }
  } catch (e) { console.error("Notification failed", e); }

  return { success: true };
}

// -------------------------------------------------------------
// 2FA / MFA DUAL-METHOD & STEP-UP SERVER ACTIONS
// -------------------------------------------------------------

async function getOrCreateSettings(supabase: any, merchantId: string) {
  const adminClient = createAdminClient();
  const { data, error: selectError } = await adminClient.from('settings')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (selectError) {
    console.error("Failed to load settings row:", selectError);
    throw new Error("Impossible de charger les paramètres de sécurité");
  }
  if (data) return data;

  const { data: inserted, error: insertError } = await adminClient.from('settings')
    .insert({
      merchant_id: merchantId,
      transaction_fee_percent: 2.9,
      settlement_method: 'manual',
      security_json: { two_factor_method: 'none' }
    })
    .select()
    .single();

  if (insertError?.code === '23505') {
    const { data: concurrentRow, error: concurrentError } = await adminClient
      .from('settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .single();
    if (!concurrentError && concurrentRow) return concurrentRow;
  }

  if (insertError || !inserted) {
    console.error("Failed to create settings row:", insertError);
    throw new Error("Impossible d'initialiser les paramètres de sécurité");
  }

  return inserted;
}

export async function sendEmailOtpAction() {
  const { user, merchant } = await getAuthUserAndMerchant();
  const { headers } = await import('next/headers');
  const headersList = await headers();
  
  const { LoginSecurityService } = await import('@/lib/server/security/login-context');
  const context = LoginSecurityService.extractContext(headersList);

  await LoginSecurityService.createSecurityChallenge({
    merchantId: merchant.id,
    userId: user.id,
    userEmail: user.email!,
    context,
  });

  return { success: true };
}

export async function verifyEmailOtpAction(code: string) {
  const { user, merchant } = await getAuthUserAndMerchant();
  const cookieStore = await cookies();
  const { headers } = await import('next/headers');
  const headersList = await headers();

  const { LoginSecurityService } = await import('@/lib/server/security/login-context');
  const context = LoginSecurityService.extractContext(headersList);

  const verification = await LoginSecurityService.verifySecurityChallenge({
    merchantId: merchant.id,
    userId: user.id,
    userEmail: user.email!,
    code,
    context,
  });

  if (!verification.success) {
    throw new Error(verification.error || "Le code saisi est incorrect ou a expiré.");
  }

  cookieStore.set({
    name: 'kbr_2fa_email_ok',
    value: 'true',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  });

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function generateTotpSecretAction() {
  const { user, merchant, supabase } = await getAuthUserAndMerchant();
  const speakeasy = (await import("speakeasy")).default;
  const QRCode = (await import("qrcode")).default;
  
  const secret = speakeasy.generateSecret({
    name: `Kobara (${user.email})`,
    issuer: 'Kobara',
    length: 20,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

  const settings = await getOrCreateSettings(supabase, merchant.id);
  const security = settings.security_json || {};

  const updatedSecurity = {
    ...security,
    pending_totp_secret: secret.base32
  };

  const { data: savedSettings, error } = await createAdminClient().from('settings')
    .update({ security_json: updatedSecurity })
    .eq('merchant_id', merchant.id)
    .select('id')
    .maybeSingle();

  if (error || !savedSettings) throw new Error("Erreur lors de la génération du secret TOTP");

  return { secret: secret.base32, qrCodeDataUrl };
}

export async function verifyAndActivateTotpAction(token: string) {
  const { user, merchant, supabase } = await getAuthUserAndMerchant();
  const speakeasy = (await import("speakeasy")).default;
  const settings = await getOrCreateSettings(supabase, merchant.id);
  const security = settings.security_json || {};

  const pendingSecret = security.pending_totp_secret;
  if (!pendingSecret) {
    throw new Error("Aucune configuration TOTP en attente.");
  }

  const cleanToken = normalizeSixDigitCode(token);
  if (!cleanToken) {
    throw new Error("Le code TOTP doit comporter exactement 6 chiffres.");
  }

  const verified = speakeasy.totp.verify({
    secret: pendingSecret,
    encoding: 'base32',
    token: cleanToken,
    window: 1
  });

  if (!verified) {
    throw new Error("Le code de vérification est invalide ou expiré.");
  }

  const updatedSecurity = {
    ...security,
    two_factor_method: 'totp',
    totp_secret: pendingSecret,
    email_otp: null,
    pending_totp_secret: null
  };

  const { data: savedSettings, error } = await createAdminClient().from('settings')
    .update({ security_json: updatedSecurity })
    .eq('merchant_id', merchant.id)
    .select('id')
    .maybeSingle();

  if (error || !savedSettings) throw new Error("Erreur de sauvegarde de la configuration");

  const cookieStore = await cookies();
  cookieStore.set({
    name: 'kbr_2fa_totp_ok',
    value: 'true',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  });

  try {
    await notify2faActivation(merchant.id, user.email!, 'Application Authenticator');
  } catch (e) { console.error("Notification failed", e); }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function verifyTotpChallengeAction(code: string) {
  const { user, merchant, supabase } = await getAuthUserAndMerchant();
  const speakeasy = (await import("speakeasy")).default;
  const cookieStore = await cookies();
  const { headers } = await import('next/headers');
  const { authLimiter, getClientIp } = await import('@/lib/server/security/rate-limit');
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const rateLimit = await authLimiter.limit(`totp:${merchant.id}:${ip}`);

  if (!rateLimit.success) {
    throw new Error("Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.");
  }

  const settings = await getOrCreateSettings(supabase, merchant.id);
  const security = settings?.security_json || {};

  const secret = security.totp_secret;
  if (!secret) {
    throw new Error("L'application d'authentification n'est pas configurée pour ce compte.");
  }

  const cleanCode = normalizeSixDigitCode(code);
  if (!cleanCode) {
    throw new Error("Le code TOTP doit comporter exactement 6 chiffres.");
  }

  const verified = speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: cleanCode,
    window: 1
  });

  if (!verified) {
    throw new Error("Le code de vérification à 6 chiffres est invalide ou expiré.");
  }

  cookieStore.set({
    name: 'kbr_2fa_totp_ok',
    value: 'true',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  });

  return { success: true };
}

export async function deletePasskeyAction(passkeyId: string) {
  const { merchant } = await getAuthUserAndMerchant();

  const { data: settings } = await createAdminClient().from('settings')
    .select('security_json')
    .eq('merchant_id', merchant.id)
    .single();

  const security = settings?.security_json || {};
  const passkeys = security.passkeys || [];

  const updatedPasskeys = passkeys.filter((pk: any) => pk.id !== passkeyId);

  const { error } = await createAdminClient().from('settings')
    .update({ security_json: { ...security, passkeys: updatedPasskeys } })
    .eq('merchant_id', merchant.id);

  if (error) throw new Error("Erreur lors de la suppression de la clé biométrique");

  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function disable2faAction() {
  const { merchant, supabase } = await getAuthUserAndMerchant();
  const cookieStore = await cookies();

  const settings = await getOrCreateSettings(supabase, merchant.id);
  const security = settings.security_json || {};

  const updatedSecurity = {
    ...security,
    two_factor_method: 'none',
    email_otp: null,
    totp_secret: null,
    pending_totp_secret: null,
  };

  const { error } = await createAdminClient().from('settings')
    .update({ security_json: updatedSecurity })
    .eq('merchant_id', merchant.id);

  if (error) throw new Error("Impossible de désactiver le 2FA");

  cookieStore.delete('kbr_2fa_email_ok');
  cookieStore.delete('kbr_2fa_totp_ok');

  revalidatePath('/dashboard/settings');
  return { success: true };
}

/**
 * Récupère le statut de connexion Telegram du marchand
 */
export async function getTelegramLinkStatusAction() {
  const { merchant } = await getAuthUserAndMerchant();
  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from('merchant_telegram_accounts')
    .select('telegram_chat_id, telegram_username, first_name, notifications_enabled, linked_at')
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  return {
    linked: !!link,
    telegramUsername: link?.telegram_username || null,
    firstName: link?.first_name || null,
    notificationsEnabled: link?.notifications_enabled ?? false,
    linkedAt: link?.linked_at || null,
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'KobaraPayBot',
  };
}

/**
 * Génère un jeton sécurisé temporaire pour lier le compte Telegram
 */
export async function generateTelegramLinkTokenAction() {
  const { merchant } = await getAuthUserAndMerchant();
  const supabase = createAdminClient();
  const crypto = await import('crypto');

  // Générer un token unique à 32 caractères
  const token = `kbr_${crypto.randomBytes(16).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

  // Invalider les anciens tokens non utilisés
  await supabase
    .from('telegram_link_tokens')
    .delete()
    .eq('merchant_id', merchant.id);

  // Insérer le nouveau token
  const { error } = await supabase
    .from('telegram_link_tokens')
    .insert({
      merchant_id: merchant.id,
      token,
      expires_at: expiresAt,
    });

  if (error) {
    throw new Error("Impossible de générer le lien de connexion Telegram.");
  }

  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KobaraPayBot';
  const telegramUrl = `https://t.me/${botUsername}?start=${token}`;

  return {
    token,
    telegramUrl,
    expiresAt,
  };
}

/**
 * Dissocie le compte Telegram du marchand
 */
export async function unlinkTelegramAccountAction() {
  const { merchant } = await getAuthUserAndMerchant();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('merchant_telegram_accounts')
    .delete()
    .eq('merchant_id', merchant.id);

  if (error) {
    throw new Error("Impossible de dissocier le compte Telegram.");
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}

/**
 * Active / désactive les notifications Telegram
 */
export async function toggleTelegramNotificationsAction(enabled: boolean) {
  const { merchant } = await getAuthUserAndMerchant();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('merchant_telegram_accounts')
    .update({ notifications_enabled: enabled })
    .eq('merchant_id', merchant.id);

  if (error) {
    throw new Error("Impossible de modifier les préférences Telegram.");
  }

  revalidatePath('/dashboard/settings');
  return { success: true };
}
