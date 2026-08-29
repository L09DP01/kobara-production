'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { parseUserAgent } from "@/lib/utils/parse-user-agent";
import crypto from "crypto";

type LoginMethod = 'password' | 'passkey' | 'mobile-sso';

const SESSION_COOKIE_NAMES = [
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

async function getCurrentSessionToken(userId: string, userAgent: string, ip: string): Promise<string> {
  const cookieStore = await cookies();
  const sessionCookie = SESSION_COOKIE_NAMES
    .map((name) => cookieStore.get(name)?.value)
    .find(Boolean);

  const raw = sessionCookie || `${userId}:${userAgent}:${ip.split(',')[0].trim()}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function resolveSessionStatus(session: any) {
  if (session.revoked_at || session.status === 'revoked' || session.is_active === false) return 'revoked';
  if (session.expires_at && new Date(session.expires_at) <= new Date()) return 'expired';
  return 'active';
}

function getBrowserParts(browser: string) {
  const match = browser.match(/^(.*?)(?:\s+(\d[\d.]*))?$/);
  return {
    name: match?.[1]?.trim() || browser || 'Navigateur inconnu',
    version: match?.[2] || '',
  };
}

function getNormalizedDeviceType(device: string) {
  if (device === 'Mobile') return 'mobile';
  if (device === 'Tablette') return 'tablet';
  if (device === 'Desktop') return 'desktop';
  return 'desktop';
}

function getDeviceName(device: string, os: string) {
  if (device === 'Mobile') return `Mobile ${os}`;
  if (device === 'Tablette') return `Tablette ${os}`;
  if (device === 'Desktop') return `Ordinateur ${os}`;
  return `${device} ${os}`.trim();
}

function getRequestDeviceInfo(userAgent: string) {
  const { browser, os, device } = parseUserAgent(userAgent);
  const browserParts = getBrowserParts(browser);

  return {
    browser: browserParts.name,
    browser_version: browserParts.version,
    operating_system: os,
    device_type: getNormalizedDeviceType(device),
    device_name: getDeviceName(device, os),
  };
}

async function getRequestMeta() {
  const headersList = await headers();
  return {
    userAgent: headersList.get('user-agent') || 'Inconnu',
    ip: headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || '127.0.0.1',
  };
}

export async function recordCurrentSession(method: LoginMethod = 'password') {
  try {
    const { user, merchant, userRole } = await getCurrentUserAndMerchant();
    const { userAgent, ip } = await getRequestMeta();
    const deviceInfo = getRequestDeviceInfo(userAgent);
    const sessionToken = await getCurrentSessionToken(user.id, userAgent, ip);
    const adminClient = createAdminClient();

    const { data: existingSession } = await adminClient
      .from('merchant_sessions')
      .select('id, revoked_at, status, is_active')
      .eq('session_token', sessionToken)
      .maybeSingle();

    if (existingSession?.revoked_at || existingSession?.status === 'revoked' || existingSession?.is_active === false) {
      return sessionToken;
    }

    let locationStr = 'Haiti';
    const apiKey = process.env.IPINFO_API_KEY;
    if (apiKey && ip && !ip.startsWith('127.') && !ip.startsWith('192.168.') && !ip.startsWith('10.')) {
      try {
        const geoRes = await fetch(`https://ipinfo.io/${ip}?token=${apiKey}`, { signal: AbortSignal.timeout(2000) });
        if (geoRes.ok) {
          const geo = await geoRes.json();
          locationStr = [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || locationStr;
        }
      } catch {
        // Geo lookup must never block the dashboard.
      }
    }

    const sessionData: any = {
      merchant_id: merchant.id,
      session_token: sessionToken,
      user_id: user.id,
      user_email: user.email,
      user_role: userRole,
      ip_address: ip,
      user_agent: userAgent,
      ...deviceInfo,
      location: locationStr,
      login_method: method,
      status: 'active',
      is_active: true,
      revoked_at: null,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      last_active_at: new Date().toISOString(),
    };

    const { error: upsertError } = await adminClient
      .from('merchant_sessions')
      .upsert(sessionData, { onConflict: 'session_token' });

    if (upsertError) {
      console.error('[SESSIONS] recordCurrentSession failed', {
        user_id: user.id,
        merchant_id: merchant.id,
        error: upsertError.message,
      });
    }

    return sessionToken;
  } catch (error) {
    console.error('[SESSIONS] recordCurrentSession unexpected error', error);
    return null;
  }
}

export async function getActiveSessions() {
  const { user, merchant } = await getCurrentUserAndMerchant();
  const { userAgent, ip } = await getRequestMeta();
  const adminClient = createAdminClient();
  const currentToken = await getCurrentSessionToken(user.id, userAgent, ip);

  await recordCurrentSession('password');

  const { data, error } = await adminClient
    .from('merchant_sessions')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_active_at', { ascending: false });

  if (error) {
    console.error('[SESSIONS] getActiveSessions failed', {
      user_id: user.id,
      merchant_id: merchant.id,
      error: error.message,
    });
    return { sessions: [], currentToken };
  }

  console.log('[SESSIONS] active sessions loaded', {
    user_id: user.id,
    count: data?.length || 0,
  });

  const sessions = (data || [])
    .map((session: any) => {
      const parsed = parseUserAgent(session.user_agent);
      const browserParts = getBrowserParts(parsed.browser);
      const deviceInfo = getRequestDeviceInfo(session.user_agent || '');

      return {
        ...session,
        user_email: session.user_email || user.email || merchant.email || 'Membre Kobara',
        user_role: session.user_role || (session.user_id === merchant.user_id ? 'owner' : 'developer'),
        browser: session.browser || browserParts.name,
        browser_version: session.browser_version || browserParts.version,
        operating_system: session.operating_system || parsed.os,
        device_type: session.device_type || deviceInfo.device_type,
        device_name: session.device_name || deviceInfo.device_name,
        session_status: resolveSessionStatus(session),
        isCurrent: session.session_token === currentToken,
      };
    })
    .filter((session: any) => session.session_status === 'active');

  return { sessions, currentToken };
}

export async function revokeSession(sessionId: string) {
  const { user, merchant } = await getCurrentUserAndMerchant();
  const adminClient = createAdminClient();

  console.log('[SESSIONS] revokeSession requested', {
    user_id: user.id,
    session_id: sessionId,
  });

  const { error } = await adminClient
    .from('merchant_sessions')
    .update({
      status: 'revoked',
      is_active: false,
      revoked_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .eq('merchant_id', merchant.id)
    .eq('user_id', user.id);

  if (error) {
    console.error('[SESSIONS] revokeSession failed', {
      user_id: user.id,
      session_id: sessionId,
      error: error.message,
    });
    return { error: "Impossible de deconnecter cette session. Reessayez." };
  }

  console.log('[SESSIONS] revokeSession success', { user_id: user.id, session_id: sessionId });
  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function revokeOtherSessions(currentToken: string) {
  const { user, merchant } = await getCurrentUserAndMerchant();
  const adminClient = createAdminClient();

  console.log('[SESSIONS] revokeOtherSessions requested', { user_id: user.id });

  const { error } = await adminClient
    .from('merchant_sessions')
    .update({
      status: 'revoked',
      is_active: false,
      revoked_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
    })
    .eq('merchant_id', merchant.id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .neq('session_token', currentToken);

  if (error) {
    console.error('[SESSIONS] revokeOtherSessions failed', {
      user_id: user.id,
      error: error.message,
    });
    return { error: "Impossible de deconnecter les autres sessions. Reessayez." };
  }

  console.log('[SESSIONS] revokeOtherSessions success', { user_id: user.id });
  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function ensureCurrentSessionIsAllowed(method: LoginMethod = 'password') {
  const token = await recordCurrentSession(method);
  if (!token) return { allowed: true };

  const { user, merchant } = await getCurrentUserAndMerchant();
  const adminClient = createAdminClient();

  const { data: session } = await adminClient
    .from('merchant_sessions')
    .select('revoked_at, status, is_active, expires_at')
    .eq('merchant_id', merchant.id)
    .eq('user_id', user.id)
    .eq('session_token', token)
    .maybeSingle();

  if (!session) return { allowed: true };

  const status = resolveSessionStatus(session);
  return { allowed: status === 'active', status };
}

export async function getCurrentSessionStatus() {
  try {
    const { user, merchant } = await getCurrentUserAndMerchant();
    const { userAgent, ip } = await getRequestMeta();
    const token = await getCurrentSessionToken(user.id, userAgent, ip);
    const adminClient = createAdminClient();

    const { data: session } = await adminClient
      .from('merchant_sessions')
      .select('revoked_at, status, is_active, expires_at')
      .eq('merchant_id', merchant.id)
      .eq('user_id', user.id)
      .eq('session_token', token)
      .maybeSingle();

    if (!session) return { active: true, status: 'active' };

    const status = resolveSessionStatus(session);
    return { active: status === 'active', status };
  } catch {
    return { active: true, status: 'active' };
  }
}
