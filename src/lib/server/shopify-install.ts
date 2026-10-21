import 'server-only';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildShopifyAuthorizationUrl, encryptShopifyTokenSet, exchangeShopifyAuthorizationCode,
  getShopifyConfig, getShopifyShopIdentity, normalizeShopDomain, parseShopifyNumericId,
  registerShopifyWebhooks, verifyShopifyOAuthHmac } from '@/lib/server/shopify';

export const SHOPIFY_INSTALL_COOKIE = '__Host-kobara_shopify_install';
const audience = 'kobara-shopify-install';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const secret = () => new TextEncoder().encode(getShopifyConfig().clientSecret);

export function verifyShopifyInstallEntry(params: URLSearchParams, now = Date.now()) {
  const keys = [...params.keys()];
  if (new Set(keys).size !== keys.length || !verifyShopifyOAuthHmac(params)) throw new Error('invalid_installation');
  const timestamp = Number(params.get('timestamp'));
  if (!Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 300) throw new Error('expired_installation');
  return normalizeShopDomain(params.get('shop') || '');
}

function browserProof(value?: string) {
  const match = /^([0-9a-f-]{36})\.([A-Za-z0-9_-]{43})$/.exec(value || '');
  return match ? { id: match[1], hash: digest(match[2]) } : null;
}

export async function startShopifyInstall(params: URLSearchParams) {
  const shop = verifyShopifyInstallEntry(params);
  if (new URL(getShopifyConfig().appUrl).protocol !== 'https:') throw new Error('https_required');
  const id = randomUUID();
  const browser = randomBytes(32).toString('base64url');
  const nonce = randomBytes(24).toString('base64url');
  const db = createAdminClient();
  const { error } = await db.from('shopify_oauth_handoffs').insert({
    id, shop_domain: shop, browser_hash: digest(browser), nonce_hash: digest(nonce), status: 'pending',
    expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  if (error) throw new Error('installation_storage_unavailable');
  const state = await new SignJWT({ shop, nonce }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(id).setAudience(audience).setIssuedAt().setExpirationTime('10m').sign(secret());
  const response = NextResponse.redirect(buildShopifyAuthorizationUrl(shop, state));
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set(SHOPIFY_INSTALL_COOKIE, `${id}.${browser}`, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 1800,
  });
  return response;
}

export async function finishShopifyInstall(request: NextRequest): Promise<NextResponse | null> {
  let payload;
  try {
    payload = (await jwtVerify(request.nextUrl.searchParams.get('state') || '', secret(), {
      audience, algorithms: ['HS256'],
    })).payload;
  } catch { return null; } // Legacy merchant-bound callbacks have a different audience.
  const params = request.nextUrl.searchParams;
  const proof = browserProof(request.cookies.get(SHOPIFY_INSTALL_COOKIE)?.value);
  const shop = normalizeShopDomain(params.get('shop') || '');
  if (!verifyShopifyOAuthHmac(params) || !proof || proof.id !== payload.sub || shop !== payload.shop
    || typeof payload.nonce !== 'string' || !params.get('code')) throw new Error('invalid_installation');
  const db = createAdminClient();
  const { data: pending, error } = await db.from('shopify_oauth_handoffs')
    .select('id, expires_at').eq('id', proof.id).eq('browser_hash', proof.hash)
    .eq('nonce_hash', digest(payload.nonce)).eq('status', 'pending').maybeSingle();
  if (error || !pending || Date.parse(pending.expires_at) <= Date.now()) throw new Error('expired_installation');
  // Consume state before exchanging a single-use code, including concurrent callbacks.
  const claimed = await db.from('shopify_oauth_handoffs').update({ status: 'exchanging' })
    .eq('id', proof.id).eq('status', 'pending').select('id').maybeSingle();
  if (claimed.error || !claimed.data) throw new Error('state_replayed');
  try {
    const token = await exchangeShopifyAuthorizationCode(shop, params.get('code')!);
    const identity = await getShopifyShopIdentity(shop, token.accessToken);
    if (normalizeShopDomain(identity.myshopifyDomain) !== shop) throw new Error('shop_mismatch');
    const webhooks = await registerShopifyWebhooks(shop, token.accessToken);
    const saved = await db.from('shopify_oauth_handoffs').update({
      expires_at: new Date(Math.min(Date.parse(pending.expires_at), token.expiresAt - 60_000)).toISOString(),
      status: 'authorized', installation_data: {
        shop_id: parseShopifyNumericId(identity.id), shop_name: identity.name,
        access_token_ciphertext: encryptShopifyTokenSet(token), granted_scopes: token.scopes,
        metadata: { webhook_subscriptions: webhooks },
      },
    }).eq('id', proof.id).eq('status', 'exchanging').select('id').maybeSingle();
    if (saved.error || !saved.data) throw new Error('save_failed');
  } catch {
    await db.from('shopify_oauth_handoffs').delete().eq('id', proof.id);
    throw new Error('installation_authorization_failed');
  }
  return NextResponse.redirect(new URL('/dashboard/integrations/shopify?link_account=1', getShopifyConfig().appUrl));
}

export async function getShopifyInstallHandoff(cookie?: string) {
  const proof = browserProof(cookie);
  if (!proof) return null;
  const { data, error } = await createAdminClient().from('shopify_oauth_handoffs')
    .select('id, shop_domain, status, expires_at').eq('id', proof.id)
    .eq('browser_hash', proof.hash).eq('status', 'authorized').maybeSingle();
  if (error || !data || Date.parse(data.expires_at) <= Date.now()) return null;
  return data;
}

export async function claimShopifyInstall(cookie: string | undefined, merchantId: string) {
  const proof = browserProof(cookie);
  if (!proof) throw new Error('invalid_installation');
  const { data, error } = await createAdminClient().rpc('claim_shopify_oauth_handoff', {
    handoff_id: proof.id, browser_hash_value: proof.hash, owner_merchant_id: merchantId,
  });
  if (error || !data) throw new Error('installation_claim_failed');
  return data as string;
}
