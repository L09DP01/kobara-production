import { SignJWT, jwtVerify } from 'jose';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import crypto from 'crypto';

const JWT_SECRET_VALUE = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;

if (!JWT_SECRET_VALUE || JWT_SECRET_VALUE.length < 32) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET must contain at least 32 characters.');
}

const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_VALUE);
const ADMIN_ROLES = new Set(['super_admin', 'operations', 'compliance', 'support']);

function hashOtp(email: string, code: string) {
  return crypto
    .createHmac('sha256', JWT_SECRET_VALUE as string)
    .update(`${email.toLowerCase()}:${code}`)
    .digest('hex');
}

// 5 minutes in milliseconds
export const ADMIN_SESSION_TIMEOUT_MS = 5 * 60 * 1000;

export async function generateAdminOtp(email: string) {
  const supabase = createAdminClient();
  
  // Verify if email is a super admin
  const { data: admin } = await supabase
    .from('super_admins')
    .select('id, is_active')
    .ilike('email', email)
    .single();

  if (!admin?.is_active) {
    // Return success to avoid email enumeration, but don't do anything
    return { success: true };
  }

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recentOtp } = await supabase
    .from('admin_otps')
    .select('id')
    .ilike('email', email)
    .gte('created_at', oneMinuteAgo)
    .limit(1)
    .maybeSingle();

  if (recentOtp) return { success: true };

  const code = crypto.randomInt(100000, 1_000_000).toString();
  
  // Expires in 5 minutes
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);

  // Invalidate previous OTPs
  await supabase
    .from('admin_otps')
    .update({ used: true })
    .eq('email', email)
    .eq('used', false);

  // Save new OTP
  const { error: insertError } = await supabase
    .from('admin_otps')
    .insert({
      email,
      code: null,
      code_hash: hashOtp(email, code),
      expires_at: expiresAt.toISOString(),
      used: false,
      attempts: 0,
    });

  if (insertError) {
    console.error('Unable to persist administrator OTP:', insertError.message);
    throw new Error("Impossible d'envoyer le code administrateur pour le moment.");
  }

  // Send email (this uses nodemailer with real SMTP if configured)
  try {
    await sendEmail({
      to: email,
      subject: "Code de vérification Super Admin",
      text: `Bonjour Administrateur,

Une connexion au panneau Super Admin a été demandée.
Ce code est valide pendant 5 minutes. Ne le partagez avec personne.

Votre code de vérification temporaire à 6 chiffres pour votre compte Kobara est : ${code}`
    });
  } catch (error) {
    await supabase.from('admin_otps').update({ used: true }).eq('email', email).eq('used', false);
    throw error;
  }

  return { success: true };
}

export async function verifyAdminOtp(email: string, code: string) {
  const supabase = createAdminClient();
  const normalizedEmail = email.trim().toLowerCase();
  
  const { data: otp } = await supabase
    .from('admin_otps')
    .select('id, code_hash, expires_at, attempts')
    .ilike('email', normalizedEmail)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp || new Date(otp.expires_at) <= new Date() || Number(otp.attempts || 0) >= 5) {
    return { success: false, error: 'Code invalide ou expiré' };
  }

  const expected = Buffer.from(otp.code_hash || '', 'hex');
  const received = Buffer.from(hashOtp(normalizedEmail, code), 'hex');
  const validCode = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!validCode) {
    await supabase.from('admin_otps').update({ attempts: Number(otp.attempts || 0) + 1 }).eq('id', otp.id);
    return { success: false, error: 'Code invalide ou expiré' };
  }

  // Mark as used
  await supabase
    .from('admin_otps')
    .update({ used: true })
    .eq('id', otp.id);

  // Verify it's still a super admin
  const { data: admin } = await supabase
    .from('super_admins')
    .select('id, email, role, is_active')
    .ilike('email', normalizedEmail)
    .single();

  if (!admin?.is_active || !ADMIN_ROLES.has(admin.role)) {
    return { success: false, error: 'Accès refusé' };
  }

  await supabase.from('super_admins').update({ last_login_at: new Date().toISOString() }).eq('id', admin.id);

  // Generate JWT
  const token = await new SignJWT({ email: admin.email, role: admin.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(admin.id)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET);

  return { success: true, token, adminId: admin.id };
}

export async function verifyAdminJwt(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub || !ADMIN_ROLES.has(String(payload.role))) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function refreshAdminJwt(token: string) {
  const payload = await verifyAdminJwt(token);
  if (!payload) return null;

  // Generate new token with new 5m expiration
  const newToken = await new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub as string)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET);

  return newToken;
}
