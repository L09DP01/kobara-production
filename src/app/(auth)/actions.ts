"use server"

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { sendWelcomeEmail, sendPasswordResetEmail } from '@/lib/server/mail'
import { getMaintenanceState } from '@/lib/server/maintenance'
import { isMaintenanceActive } from '@/lib/maintenance-state'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import dns from 'dns'

import { authLimiter, getClientIp } from '@/lib/server/security/rate-limit'
import { verifyTurnstileToken } from '@/lib/server/security/turnstile'
import {
  BUSINESS_NAME_TAKEN_MESSAGE,
  getBusinessNameValidationError,
  isBusinessNameConflict,
  normalizeBusinessName,
} from '@/lib/business-name'

// DNS MX records check to prevent fake emails
async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await dns.promises.resolveMx(domain);
    return records && records.length > 0;
  } catch (err) {
    console.warn(`DNS resolveMx check failed for domain: ${domain}`, err);
    return false;
  }
}

export async function signup(formData: FormData) {
  const maintenance = await getMaintenanceState();
  if (isMaintenanceActive(maintenance)) redirect('/maintenance');

  // Rate limiting by real client IP
  const { headers } = await import('next/headers');
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const { success } = await authLimiter.limit(`signup:${ip}`);
  if (!success) {
    redirect('/register?error=' + encodeURIComponent("Trop de tentatives. Veuillez réessayer plus tard."));
  }

  // Human Verification (Turnstile CAPTCHA)
  const turnstileToken = (formData.get('cf-turnstile-response') as string) || (formData.get('turnstile_token') as string);
  const turnstileCheck = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileCheck.success) {
    redirect('/register?error=' + encodeURIComponent(turnstileCheck.error || "Vérification humaine requise."));
  }

  const emailInput = formData.get('email') as string;
  const password = formData.get('password') as string;
  const businessName = normalizeBusinessName(formData.get('business_name'));

  if (!emailInput || !password) {
    redirect('/register?error=' + encodeURIComponent("Veuillez remplir tous les champs requis."));
  }

  const businessNameError = getBusinessNameValidationError(businessName);
  if (businessNameError) {
    redirect('/register?error=' + encodeURIComponent(businessNameError));
  }

  const email = emailInput.toLowerCase().trim();
  const domain = email.split('@')[1];

  if (!domain) {
    redirect('/register?error=' + encodeURIComponent("Format d'adresse e-mail invalide."));
  }

  // 1. Domain verification using DNS MX records to reject fake email domains
  const isRealDomain = await checkMxRecords(domain);
  if (!isRealDomain) {
    redirect(
      '/register?error=' +
        encodeURIComponent(
          "L'adresse e-mail saisie n'est pas valide ou provient d'un domaine inexistant sans serveur de messagerie actif."
        )
    );
  }

  const supabase = createAdminClient();

  // 2. Check if user already exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    redirect('/register?error=' + encodeURIComponent("Un compte avec cet e-mail existe déjà."));
  }

  // 3. Hash password using bcryptjs
  const hashedPassword = await bcrypt.hash(password, 10);

  // 4. Generate verification token and expiration date (24 hours)
  const userId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('hex');
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // 5. Create user record
  const { error: userError } = await supabase.from('users').insert({
    id: userId,
    email,
    password_hash: hashedPassword,
    email_verified: false,
    verification_token: token,
    verification_token_expires: tokenExpires
  });

  if (userError) {
    console.error("Signup User Error:", userError);
    redirect('/register?error=' + encodeURIComponent("Une erreur est survenue lors de la création de votre compte."));
  }

  // 6. Create or link merchant profile
  const { data: existingMerchant } = await supabase
    .from('merchants')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingMerchant) {
    // Re-link the existing merchant to the new public.users row
    const { error: updateError } = await supabase
      .from('merchants')
      .update({ user_id: userId })
      .eq('id', existingMerchant.id);

    if (updateError) {
      console.error("Re-linking Merchant Error:", updateError);
      // Cleanup incomplete user record
      await supabase.from('users').delete().eq('id', userId);
      redirect('/register?error=' + encodeURIComponent("Une erreur est survenue lors de la mise à jour de votre profil marchand existant."));
    }
  } else {
    // Create new merchant profile
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.floor(Math.random() * 1000);
    const { error: merchantError } = await supabase.from('merchants').insert({
      user_id: userId,
      business_name: businessName,
      business_slug: slug,
      email,
    });

    if (merchantError) {
      console.error("Signup Merchant Error:", merchantError);
      // Cleanup incomplete user record
      await supabase.from('users').delete().eq('id', userId);
      if (isBusinessNameConflict(merchantError)) {
        redirect('/register?error=' + encodeURIComponent(BUSINESS_NAME_TAKEN_MESSAGE));
      }
      redirect('/register?error=' + encodeURIComponent("Une erreur est survenue lors de la création de votre profil marchand."));
    }
  }

  // 7. Send activation e-mail via Resend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const verificationLink = `${appUrl}/api/auth/verify-email?token=${token}`;

  await sendWelcomeEmail({
    to: email,
    verificationLink
  });

  // 8. Redirect user to login with explicit verification prompt
  redirect('/login?registered=true&email=' + encodeURIComponent(email));
}

export async function logout() {
  const cookieStore = await cookies();
  const domain = process.env.NODE_ENV === 'production' ? '.kobara.app' : 'localhost';
  
  // Clear all NextAuth related cookies safely on the correct domain
  const cookiesToDelete = [
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.callback-url',
    '__Secure-next-auth.csrf-token',
    'kbr_2fa_email_ok',
    'kbr_2fa_totp_ok',
    'kobara_last_activity',
  ];

  for (const name of cookiesToDelete) {
    cookieStore.delete(name);
    cookieStore.set(name, '', { domain, maxAge: 0, path: '/' });
  }
  
  redirect('/login');
}

export async function requestPasswordReset(emailInput: string, lang: string = 'fr', turnstileToken?: string) {
  const turnstileCheck = await verifyTurnstileToken(turnstileToken);
  if (!turnstileCheck.success) {
    return { error: turnstileCheck.error || (lang === 'en' ? "Human verification failed." : "La vérification humaine a échoué.") };
  }

  if (!emailInput) {
    return { error: lang === 'en' ? "Please enter your email address." : "Veuillez saisir votre adresse e-mail." };
  }

  const email = emailInput.toLowerCase().trim();
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .maybeSingle();

  if (error || !user) {
    return { error: lang === 'en' ? "No account exists with this email address." : "Aucun compte n'existe avec cette adresse e-mail." };
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('users')
    .update({
      reset_token: token,
      reset_token_expires: expires
    })
    .eq('id', user.id);

  if (updateError) {
    console.error("Error setting password reset token:", updateError);
    return { error: lang === 'en' ? "An error occurred while initiating password reset." : "Une erreur est survenue lors de la réinitialisation de votre mot de passe." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail({
    to: email,
    resetLink
  });

  return { success: true };
}

export async function resetPassword(token: string, passwordInput: string, lang: string = 'fr') {
  if (!token || !passwordInput) {
    return { error: lang === 'en' ? "Invalid request." : "Requête invalide." };
  }

  const supabase = createAdminClient();

  const now = new Date().toISOString();
  const { data: user, error } = await supabase
    .from('users')
    .select('id, reset_token_expires')
    .eq('reset_token', token)
    .gt('reset_token_expires', now)
    .maybeSingle();

  if (error || !user) {
    return { error: lang === 'en' ? "The reset link is invalid or has expired." : "Le lien de réinitialisation est invalide ou a expiré." };
  }

  const hashedPassword = await bcrypt.hash(passwordInput, 10);

  const { error: updateError } = await supabase
    .from('users')
    .update({
      password_hash: hashedPassword,
      reset_token: null,
      reset_token_expires: null
    })
    .eq('id', user.id);

  if (updateError) {
    console.error("Error resetting password:", updateError);
    return { error: lang === 'en' ? "An error occurred while updating your password." : "Une erreur est survenue lors de la mise à jour de votre mot de passe." };
  }

  return { success: true };
}

export async function verifyCredentialsAction(emailInput: string, passwordInput: string, lang: string = 'fr', turnstileToken?: string) {
  const turnstileCheck = await verifyTurnstileToken(turnstileToken);
  if (!turnstileCheck.success) {
    return { error: turnstileCheck.error || (lang === 'en' ? "Human verification failed." : "La vérification humaine a échoué.") };
  }

  if (!emailInput || !passwordInput) {
    return { error: lang === 'en' ? "Please enter your email and password." : "Veuillez saisir votre e-mail et votre mot de passe." };
  }

  const email = emailInput.toLowerCase().trim();
  const supabase = createAdminClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !user) {
    return { error: lang === 'en' ? "No account exists with this email." : "Aucun compte n'existe avec cet e-mail." };
  }

  const passwordMatches = await bcrypt.compare(passwordInput, user.password_hash);
  if (!passwordMatches) {
    return { error: lang === 'en' ? "Incorrect password." : "Mot de passe incorrect." };
  }

  if (!user.email_verified) {
    return {
      error: lang === 'en'
        ? "Your account is not verified yet. Please check your inbox to validate your account."
        : "Votre compte n'est pas encore vérifié. Veuillez consulter votre boîte de réception pour valider votre compte."
    };
  }

  return { success: true };
}
