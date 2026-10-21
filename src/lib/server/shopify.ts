import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { PayPalService } from '@/lib/server/payments/paypal';
import { canCollectShopifyOrder, isMatchingShopifyPayment, shopifyOrderAmount, shopifyOrderId, shopifyCollectionAmount, shopifyExchangeRate, shopifyProductName } from '@/lib/shopify-policy';

export const SHOPIFY_SCOPES = ['read_orders', 'write_orders'] as const;

export function hasRequiredShopifyScopes(granted: string[]): boolean {
  return SHOPIFY_SCOPES.every(scope => granted.includes(scope)
    || (scope.startsWith('read_') && granted.includes(`write_${scope.slice(5)}`)));
}

export function safeShopifyOAuthFailure(error: unknown, sensitiveValues: string[] = []): string {
  if (!(error instanceof Error)) return 'Unknown error';
  let message = `${error.name}: ${error.message}`;
  const secrets = Object.entries(process.env)
    .filter(([key, value]) => /SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|API_KEY/.test(key) && value && value.length > 3)
    .map(([, value]) => value as string);
  for (const secret of [...secrets, ...sensitiveValues].filter(Boolean).sort((a, b) => b.length - a.length)) {
    message = message.split(secret).join('[redacted]');
  }
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/[A-Za-z0-9_+/=-]{24,}/g, '[redacted]')
    .replace(/[\r\n\t]/g, ' ').slice(0, 200);
}

type ShopifyConfig = {
  clientId: string;
  clientSecret: string;
  apiVersion: string;
  appUrl: string;
  redirectUrl: string;
};

type ShopifyInstallation = {
  id: string;
  merchant_id: string;
  shop_domain: string;
  status: string;
  access_token_ciphertext: string | null;
};

type ShopifyTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshExpiresAt: number;
};

function parseShopifyTokenResponse(payload: Record<string, unknown>): ShopifyTokenSet {
  const expiresIn = Number(payload.expires_in);
  const refreshExpiresIn = Number(payload.refresh_token_expires_in);
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('oauth_token_missing');
  if (typeof payload.refresh_token !== 'string' || !payload.refresh_token
    || !Number.isFinite(expiresIn) || expiresIn <= 0
    || !Number.isFinite(refreshExpiresIn) || refreshExpiresIn <= 0) {
    throw new Error('oauth_expiring_token_missing');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + expiresIn * 1000,
    refreshExpiresAt: Date.now() + refreshExpiresIn * 1000,
  };
}

export function encryptShopifyTokenSet(token: ShopifyTokenSet): string {
  return encryptShopifyAccessToken(JSON.stringify({ version: 1, ...token }));
}

export async function getShopifyAccessToken(installation: ShopifyInstallation, attempt = 0): Promise<string> {
  if (attempt > 2) throw new Error('oauth_refresh_retry_required');
  const supabase = createAdminClient();
  const readCurrent = async () => {
    const { data, error } = await supabase.from('shopify_installations')
      .select('access_token_ciphertext').eq('id', installation.id)
      .eq('merchant_id', installation.merchant_id).eq('status', 'active').maybeSingle();
    if (error || !data?.access_token_ciphertext) throw new Error('Installation Shopify inactive.');
    return data.access_token_ciphertext as string;
  };
  const ciphertext = await readCurrent();
  const plaintext = decryptShopifyAccessToken(ciphertext);
  // Keep compatibility with installations created before expiring tokens were introduced.
  if (!plaintext.startsWith('{')) return plaintext;
  const stored = JSON.parse(plaintext) as ShopifyTokenSet & { version: number };
  if (stored.version !== 1 || !stored.accessToken || !stored.refreshToken
    || !Number.isFinite(stored.expiresAt) || !Number.isFinite(stored.refreshExpiresAt)) {
    throw new Error('oauth_stored_token_invalid');
  }
  if (stored.expiresAt > Date.now() + 60_000) return stored.accessToken;
  if (stored.refreshExpiresAt <= Date.now()) throw new Error('oauth_reauthorization_required');
  const config = getShopifyConfig();
  const response = await fetch(`https://${installation.shop_domain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret,
      grant_type: 'refresh_token', refresh_token: stored.refreshToken }),
    cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const current = await readCurrent();
    if (current !== ciphertext) return getShopifyAccessToken(installation, attempt + 1);
    throw new Error(`oauth_refresh_http_${response.status}`);
  }
  const token = parseShopifyTokenResponse(await response.json());
  // Compare-and-swap prevents a concurrent refresh or disconnect from being overwritten.
  const { data, error } = await supabase.from('shopify_installations').update({
    access_token_ciphertext: encryptShopifyTokenSet(token), updated_at: new Date().toISOString(),
  }).eq('id', installation.id).eq('merchant_id', installation.merchant_id).eq('status', 'active')
    .eq('access_token_ciphertext', ciphertext).select('id').maybeSingle();
  if (error) throw new Error('oauth_refresh_save_failed');
  if (!data) return getShopifyAccessToken(installation, attempt + 1);
  return token.accessToken;
}

type ShopifyOrderPayload = {
  id?: string | number;
  admin_graphql_api_id?: string;
  order_status_url?: string;
  name?: string;
  order_number?: string | number;
  currency?: string;
  presentment_currency?: string;
  total_price?: string | number;
  current_total_price?: string | number;
  financial_status?: string;
  payment_gateway_names?: string[];
  cancelled_at?: string | null;
  test?: boolean;
  fulfillment_status?: string | null;
  email?: string | null;
  phone?: string | null;
  customer?: {
    id?: string | number;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  line_items?: Array<{ title?: string; name?: string; quantity?: number }>;
  [key: string]: unknown;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} est manquant.`);
  return value;
}

export function getShopifyConfig(): ShopifyConfig {
  const appUrl = (process.env.SHOPIFY_APP_URL || 'https://dashboard.kobara.app')
    .trim()
    .replace(/\/$/, '');
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || '2026-07';
  return {
    clientId: requiredEnv('SHOPIFY_CLIENT_ID'),
    clientSecret: requiredEnv('SHOPIFY_CLIENT_SECRET'),
    apiVersion,
    appUrl,
    redirectUrl: `${appUrl}/api/integrations/shopify/callback`,
  };
}

export function normalizeShopDomain(input: string): string {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
  if (!value.includes('.')) value = `${value}.myshopify.com`;
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value)) {
    throw new Error('Utilisez le domaine permanent de la boutique, par exemple ma-boutique.myshopify.com.');
  }
  return value;
}

function stateSecret(): Uint8Array {
  return new TextEncoder().encode(requiredEnv('SHOPIFY_CLIENT_SECRET'));
}

export async function createShopifyOAuthState(input: {
  merchantId: string;
  shopDomain: string;
  nonce: string;
  source?: 'dashboard' | 'telegram';
  telegramChatId?: string;
}): Promise<string> {
  return new SignJWT({
    shop: input.shopDomain,
    nonce: input.nonce,
    source: input.source || 'dashboard',
    telegram_chat_id: input.telegramChatId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.merchantId)
    .setAudience('kobara-shopify-oauth')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(stateSecret());
}

export async function verifyShopifyOAuthState(state: string) {
  const { payload } = await jwtVerify(state, stateSecret(), {
    audience: 'kobara-shopify-oauth',
  });
  if (!payload.sub || typeof payload.shop !== 'string' || typeof payload.nonce !== 'string') {
    throw new Error('État OAuth Shopify invalide.');
  }
  return {
    merchantId: payload.sub,
    shopDomain: payload.shop,
    nonce: payload.nonce,
    source: payload.source === 'telegram' ? 'telegram' as const : 'dashboard' as const,
    telegramChatId: typeof payload.telegram_chat_id === 'string' ? payload.telegram_chat_id : null,
  };
}

export function hashShopifyOAuthNonce(nonce: string): string {
  return createHash('sha256').update(nonce).digest('hex');
}

export function verifyShopifyOAuthHmac(searchParams: URLSearchParams): boolean {
  const received = searchParams.get('hmac');
  if (!received || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const message = [...searchParams.entries()]
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const expected = createHmac('sha256', getShopifyConfig().clientSecret).update(message).digest('hex');
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
}

export function verifyShopifyWebhookHmac(rawBody: string, receivedHmac: string | null): boolean {
  if (!receivedHmac) return false;
  const expected = createHmac('sha256', getShopifyConfig().clientSecret)
    .update(rawBody, 'utf8')
    .digest('base64');
  const received = Buffer.from(receivedHmac, 'base64');
  const expectedBuffer = Buffer.from(expected, 'base64');
  return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
}

function tokenEncryptionKey(): Buffer {
  return createHash('sha256').update(requiredEnv('SHOPIFY_TOKEN_ENCRYPTION_KEY')).digest();
}

export function encryptShopifyAccessToken(accessToken: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptShopifyAccessToken(payload: string): string {
  const [ivRaw, tagRaw, ciphertextRaw] = payload.split('.');
  if (!ivRaw || !tagRaw || !ciphertextRaw) throw new Error('Jeton Shopify chiffré invalide.');
  const decipher = createDecipheriv('aes-256-gcm', tokenEncryptionKey(), Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function buildShopifyAuthorizationUrl(shopDomain: string, state: string): string {
  const config = getShopifyConfig();
  const url = new URL(`https://${shopDomain}/admin/oauth/authorize`);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('scope', SHOPIFY_SCOPES.join(','));
  url.searchParams.set('redirect_uri', config.redirectUrl);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function prepareShopifyOAuthConnection(input: {
  merchantId: string;
  shopDomain: string;
  source?: 'dashboard' | 'telegram';
  telegramChatId?: string;
}): Promise<string> {
  getShopifyConfig();
  tokenEncryptionKey();
  const shopDomain = normalizeShopDomain(input.shopDomain);
  const nonce = randomBytes(24).toString('base64url');
  const state = await createShopifyOAuthState({
    merchantId: input.merchantId,
    shopDomain,
    nonce,
    source: input.source,
    telegramChatId: input.telegramChatId,
  });
  const now = new Date().toISOString();
  const supabase = createAdminClient();
  // Keep a working installation until the owner explicitly disconnects it.
  const { data: existing, error: lookupError } = await supabase.from('shopify_installations')
    .select('id, status').eq('merchant_id', input.merchantId).maybeSingle();
  if (lookupError) throw new Error('Vérification de la connexion Shopify impossible.');
  if (existing?.status === 'active') throw new Error('already_connected');
  const { error } = await supabase.from('shopify_installations').upsert({
    merchant_id: input.merchantId,
    shop_domain: shopDomain,
    status: 'pending',
    oauth_state_hash: hashShopifyOAuthNonce(nonce),
    access_token_ciphertext: null,
    disconnected_at: null,
    uninstalled_at: null,
    last_error: null,
    updated_at: now,
  }, { onConflict: 'merchant_id' });
  if (error) throw new Error(error.message);

  return buildShopifyAuthorizationUrl(shopDomain, state);
}

export async function exchangeShopifyAuthorizationCode(shopDomain: string, code: string) {
  const config = getShopifyConfig();
  const response = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, expiring: 1 }),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`oauth_token_http_${response.status}`);
  if (typeof payload.access_token !== 'string') throw new Error('oauth_token_missing');
  const scopes = String(payload.scope || '').split(',').map((scope) => scope.trim()).filter(Boolean);
  if (!hasRequiredShopifyScopes(scopes)) throw new Error('missing_scopes');
  return {
    ...parseShopifyTokenResponse(payload),
    scopes,
  };
}

export async function shopifyGraphql<T>(input: {
  shopDomain: string;
  accessToken: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const { apiVersion } = getShopifyConfig();
  const response = await fetch(`https://${input.shopDomain}/admin/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': input.accessToken,
    },
    body: JSON.stringify({ query: input.query, variables: input.variables || {} }),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors) {
    const codes = Array.isArray(payload.errors) ? payload.errors
      .map((error: { extensions?: { code?: unknown } }) => error?.extensions?.code)
      .filter((code: unknown): code is string => typeof code === 'string' && /^[A-Z_]{1,40}$/.test(code)) : [];
    throw new Error(`Erreur API Shopify (${response.status}).${codes.length ? ` ${[...new Set(codes)].join(', ')}` : ''}`);
  }
  return payload.data as T;
}

export async function getShopifyShopIdentity(shopDomain: string, accessToken: string) {
  const data = await shopifyGraphql<{
    shop: { id: string; name: string; email: string | null; myshopifyDomain: string };
  }>({
    shopDomain,
    accessToken,
    query: `query KobaraShopIdentity { shop { id name email myshopifyDomain } }`,
  });
  return data.shop;
}

export async function registerShopifyWebhooks(shopDomain: string, accessToken: string) {
  const callbackUrl = `${getShopifyConfig().appUrl}/api/integrations/shopify/webhooks`;
  const topics = ['APP_UNINSTALLED', 'ORDERS_CREATE', 'ORDERS_UPDATED'] as const;
  const query = `
    mutation KobaraWebhookCreate($topic: WebhookSubscriptionTopic!, $subscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $subscription) {
        webhookSubscription { id topic uri }
        userErrors { field message }
      }
    }
  `;
  const results = [];
  for (const topic of topics) {
    const data = await shopifyGraphql<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string; topic: string; uri: string } | null;
        userErrors: Array<{ message: string }>;
      };
    }>({
      shopDomain,
      accessToken,
      query,
      variables: { topic, subscription: { uri: callbackUrl } },
    });
    const result = data.webhookSubscriptionCreate;
    if (result.userErrors.length > 0) {
      const duplicateOnly = result.userErrors.every((error) => /already|taken|exists/i.test(error.message));
      if (!duplicateOnly) throw new Error(result.userErrors.map((error) => error.message).join(', '));
    }
    if (result.webhookSubscription) results.push(result.webhookSubscription);
  }
  return results;
}

export async function getActiveShopifyInstallation(shopDomain: string): Promise<ShopifyInstallation | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('shopify_installations')
    .select('id, merchant_id, shop_domain, status, access_token_ciphertext')
    .eq('shop_domain', normalizeShopDomain(shopDomain))
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`Installation Shopify introuvable: ${error.message}`);
  return data as ShopifyInstallation | null;
}

export async function getMerchantShopifySummary(merchantId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('shopify_installations')
    .select('shop_domain, shop_name, status, installed_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  if (error) {
    console.error('[Shopify] Integration summary unavailable:', error.message);
    return { connected: false, shopDomain: null, shopName: null };
  }
  return {
    connected: data?.status === 'active',
    shopDomain: data?.shop_domain || null,
    shopName: data?.shop_name || null,
  };
}

export function parseShopifyNumericId(gid: string): number | null {
  const value = Number(gid.split('/').pop());
  return Number.isSafeInteger(value) ? value : null;
}

export async function upsertShopifyOrder(input: {
  installation: Pick<ShopifyInstallation, 'id' | 'merchant_id'>;
  payload: ShopifyOrderPayload;
}) {
  const supabase = createAdminClient();
  const orderId = shopifyOrderId(input.payload);
  const currency = String(input.payload.currency || input.payload.presentment_currency || '').toUpperCase();
  const total = shopifyOrderAmount(input.payload);
  const customer = input.payload.customer || {};
  const baseOrder = {
    installation_id: input.installation.id,
    merchant_id: input.installation.merchant_id,
    shopify_order_id: orderId,
    order_name: input.payload.name || input.payload.order_number?.toString() || null,
    currency,
    total_amount: Number.isFinite(total) ? total : 0,
    financial_status: input.payload.financial_status || null,
    fulfillment_status: input.payload.fulfillment_status || null,
    customer: {
      id: customer.id || null,
      email: input.payload.email || customer.email || null,
      phone: input.payload.phone || customer.phone || null,
      first_name: customer.first_name || null,
      last_name: customer.last_name || null,
    },
    raw_order: input.payload,
    updated_at: new Date().toISOString(),
  };
  const { data: order, error } = await supabase.from('shopify_orders')
    .upsert(baseOrder, { onConflict: 'installation_id,shopify_order_id' })
    .select('id, payment_link_id, kobara_status').single();
  if (error) throw new Error(`Synchronisation commande Shopify impossible: ${error.message}`);
  return order;
}

export async function ensureShopifyOrderPaymentLink(input: {
  installation: Pick<ShopifyInstallation, 'id' | 'merchant_id' | 'shop_domain'>;
  payload: ShopifyOrderPayload;
}) {
  const syncedOrder = await upsertShopifyOrder(input);
  if (syncedOrder.payment_link_id) {
    const db = createAdminClient();
    const { data: link } = await db.from('payment_links').select('id, slug, amount, status, expires_at, metadata')
      .eq('id', syncedOrder.payment_link_id).eq('merchant_id', input.installation.merchant_id).maybeSingle();
    if (!canCollectShopifyOrder(input.payload) || !link || Number(link.amount) !== shopifyCollectionAmount(input.payload, shopifyExchangeRate(link.metadata?.exchange_rate))) {
      const { error } = await db.from('payment_links').update({ status: 'inactive' })
        .eq('id', syncedOrder.payment_link_id).eq('merchant_id', input.installation.merchant_id);
      if (error) throw new Error('Désactivation du lien Shopify impossible.');
    } else if (link.status === 'active' && Date.parse(link.expires_at) > Date.now()) {
      await emailShopifyPaymentLink(input, link);
    }
    return syncedOrder;
  }
  if (!canCollectShopifyOrder(input.payload)) return syncedOrder;

  const supabase = createAdminClient();
  const { data: settings, error: settingsError } = await supabase.from('shopify_installations')
    .select('metadata').eq('id', input.installation.id).eq('merchant_id', input.installation.merchant_id).maybeSingle();
  if (settingsError) throw new Error('shopify_rate_lookup_failed');
  const exchangeRate = shopifyExchangeRate(settings?.metadata?.usd_htg_rate);
  const total = shopifyCollectionAmount(input.payload, exchangeRate);
  if (!Number.isFinite(total) || total <= 0) throw new Error('invalid_collection_amount');
  const orderId = shopifyOrderId(input.payload);
  const shopifyOrderGid = `gid://shopify/Order/${orderId}`;
  const orderName = input.payload.name || input.payload.order_number?.toString() || orderId;
  const slug = `shp${randomBytes(10).toString('hex')}`;
  const { data: merchant } = await supabase
    .from('merchants')
    .select('current_environment, kyc_status')
    .eq('id', input.installation.merchant_id)
    .single();
  if (merchant?.current_environment !== 'live' || merchant.kyc_status !== 'approved') return syncedOrder;
  let { data: paymentLink, error: linkError } = await supabase.from('payment_links').insert({
    merchant_id: input.installation.merchant_id,
    environment: 'live',
    title: shopifyProductName(input.payload) || `Commande Shopify ${orderName}`,
    description: `Commande ${orderName}`,
    amount: total,
    currency: 'HTG',
    slug,
    status: 'active',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    metadata: {
      source: 'shopify',
      original_currency: input.payload.currency,
      original_amount: shopifyOrderAmount(input.payload),
      collection_currency: 'HTG',
      collection_amount: total,
      exchange_rate: input.payload.currency === 'USD' ? exchangeRate : 1,
      shopify_installation_id: input.installation.id,
      shopify_order_id: orderId,
      shopify_order_gid: shopifyOrderGid,
      shopify_shop_domain: input.installation.shop_domain,
      product_name: shopifyProductName(input.payload) || `Commande ${orderName}`,
      order_name: orderName,
      collect_phone: true,
      pass_fees_to_customer: false,
    },
  }).select('id, slug, amount, metadata').single();
  if (linkError?.code === '23505') {
    const duplicate = await supabase
      .from('payment_links')
      .select('id, slug, amount, metadata')
      .eq('metadata->>shopify_installation_id', input.installation.id)
      .eq('metadata->>shopify_order_id', orderId)
      .eq('merchant_id', input.installation.merchant_id)
      .maybeSingle();
    paymentLink = duplicate.data;
    linkError = duplicate.error;
  }
  if (linkError || !paymentLink) throw new Error(`Création du lien Shopify impossible: ${linkError?.message || 'unknown'}`);

  const checkoutUrl = `https://pay.kobara.app/${paymentLink.slug}`;
  const { error: orderUpdateError } = await supabase.from('shopify_orders').update({
    payment_link_id: paymentLink.id,
    checkout_url: checkoutUrl,
    kobara_status: 'payment_link_ready',
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', syncedOrder.id).is('payment_link_id', null);
  if (orderUpdateError) throw new Error(`Association du lien Shopify impossible: ${orderUpdateError.message}`);

  await emailShopifyPaymentLink(input, paymentLink);
  return { ...syncedOrder, payment_link_id: paymentLink.id, checkout_url: checkoutUrl };
}

async function emailShopifyPaymentLink(input: {
  installation: Pick<ShopifyInstallation, 'id' | 'merchant_id'>;
  payload: ShopifyOrderPayload;
}, link: { id: string; slug: string; amount?: number | string; metadata?: { exchange_rate?: number } }) {
  const customerEmail = input.payload.email || input.payload.customer?.email;
  if (!customerEmail) {
    console.warn('[Shopify] Payment link email skipped.', { code: 'customer_email_missing', linkId: link.id });
    return;
  }
  const db = createAdminClient();
  const { data: merchant, error: merchantError } = await db.from('merchants')
    .select('current_environment, kyc_status').eq('id', input.installation.merchant_id).maybeSingle();
  if (merchantError) throw new Error('shopify_email_merchant_lookup_failed');
  if (merchant?.current_environment !== 'live' || merchant.kyc_status !== 'approved') return;
  const { data: sent, error: lookupError } = await db.from('audit_logs').select('id')
    .eq('merchant_id', input.installation.merchant_id).eq('entity_id', link.id)
    .eq('action', 'shopify.payment_link_email_sent').limit(1).maybeSingle();
  if (lookupError) throw new Error('shopify_email_delivery_lookup_failed');
  if (sent) return;
  const orderName = input.payload.name || input.payload.order_number?.toString() || shopifyOrderId(input.payload);
  const { sendEmail } = await import('@/lib/server/mail');
  const result = await sendEmail({
    to: customerEmail,
    subject: `Finalisez le paiement de votre commande ${orderName}`,
    text: `Bonjour,\n\nVotre commande ${orderName} a été enregistrée.${input.payload.currency === 'USD' ? `\nMontant : ${shopifyOrderAmount(input.payload)} USD, soit ${link.amount} HTG (1 USD = ${shopifyExchangeRate(link.metadata?.exchange_rate)} HTG).` : ''} Finalisez son paiement sécurisé ici :\nhttps://pay.kobara.app/${link.slug}\n\nCe lien expire dans 24 heures.`,
    idempotencyKey: `shopify-order-link-${link.id}`,
  });
  if (!result.success) {
    console.error('[Shopify] Payment link email failed.', { code: 'mail_provider_rejected', linkId: link.id });
    throw new Error('shopify_payment_link_email_failed');
  }
  const { error } = await db.from('audit_logs').insert({
    merchant_id: input.installation.merchant_id, action: 'shopify.payment_link_email_sent',
    entity_type: 'payment_link', entity_id: link.id,
    metadata: { installation_id: input.installation.id },
  });
  if (error) throw new Error('shopify_email_delivery_save_failed');
}

export async function markShopifyOrderPaid(input: {
  installationId: string;
  orderGid: string;
  paymentId: string;
}) {
  const supabase = createAdminClient();
  const { data: payment } = await supabase.from('payments')
    .select('id, merchant_id, payment_link_id, environment, status, amount, currency')
    .eq('id', input.paymentId).maybeSingle();
  if (!payment || payment.environment !== 'live' || payment.status !== 'succeeded' || !payment.payment_link_id) return;
  const { data: order } = await supabase.from('shopify_orders')
    .select('id, merchant_id, payment_link_id, payment_id, currency, total_amount, kobara_status')
    .eq('installation_id', input.installationId)
    .eq('shopify_order_id', input.orderGid.split('/').pop())
    .eq('merchant_id', payment.merchant_id).maybeSingle();
  const { data: collectionLink } = await supabase.from('payment_links').select('metadata, amount')
    .eq('id', payment.payment_link_id).eq('merchant_id', payment.merchant_id).maybeSingle();
  const exchangeRate = shopifyExchangeRate(collectionLink?.metadata?.exchange_rate);
  if (!order || !collectionLink || !isMatchingShopifyPayment(payment, { ...order, exchange_rate: exchangeRate })) throw new Error('Paiement Shopify non concordant.');
  if (order.payment_id) {
    if (order.payment_id === payment.id && order.kobara_status === 'paid') return;
    throw new Error('Commande déjà associée à un paiement.');
  }
  const { data: installation, error } = await supabase
    .from('shopify_installations')
    .select('id, merchant_id, shop_domain, status, access_token_ciphertext')
    .eq('id', input.installationId)
    .eq('merchant_id', payment.merchant_id)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !installation?.access_token_ciphertext) throw new Error('Installation Shopify inactive.');
  const accessToken = await getShopifyAccessToken(installation);
  const current = await shopifyGraphql<{ order: {
    id: string; cancelledAt: string | null; displayFinancialStatus: string;
    currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  } | null }>({
    shopDomain: installation.shop_domain, accessToken,
    query: `query KobaraOrderBeforePayment($id: ID!) { order(id: $id) { id cancelledAt displayFinancialStatus currentTotalPriceSet { shopMoney { amount currencyCode } } } }`,
    variables: { id: input.orderGid },
  });
  const remote = current.order;
  if (!remote || remote.cancelledAt || remote.currentTotalPriceSet.shopMoney.currencyCode !== order.currency
    || Math.round(Number(remote.currentTotalPriceSet.shopMoney.amount) * 100) !== Math.round(Number(order.total_amount) * 100)
    || !['PENDING', 'PAID'].includes(remote.displayFinancialStatus)) {
    throw new Error('La commande Shopify a changé. Vérification manuelle requise.');
  }
  const data = await shopifyGraphql<{
    orderMarkAsPaid: { order: { id: string; displayFinancialStatus: string } | null; userErrors: Array<{ message: string }> };
  }>({
    shopDomain: installation.shop_domain,
    accessToken,
    query: `
      mutation KobaraOrderMarkAsPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          order { id displayFinancialStatus }
          userErrors { message }
        }
      }
    `,
    variables: { input: { id: input.orderGid } },
  });
  const errors = data.orderMarkAsPaid.userErrors;
  if (errors.length > 0 && !errors.every((item) => /already.*paid|no outstanding/i.test(item.message))) {
    throw new Error(errors.map((item) => item.message).join(', '));
  }
  const { error: syncError } = await supabase.from('shopify_orders').update({
    payment_id: input.paymentId,
    financial_status: 'paid',
    kobara_status: 'paid',
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('installation_id', installation.id).eq('shopify_order_id', input.orderGid.split('/').pop());
  if (syncError) throw new Error('Confirmation locale Shopify impossible.');
  await supabase.from('payment_links').update({ status: 'inactive' })
    .eq('id', payment.payment_link_id).eq('merchant_id', payment.merchant_id);
}

export async function reconcileShopifyPayment(paymentId: string, paymentLinkId: string) {
  const { data: order, error } = await createAdminClient().from('shopify_orders')
    .select('installation_id, shopify_order_id').eq('payment_link_id', paymentLinkId).maybeSingle();
  if (error) throw new Error('Recherche de commande Shopify impossible.');
  if (!order) return;
  return markShopifyOrderPaid({ installationId: order.installation_id, orderGid: `gid://shopify/Order/${order.shopify_order_id}`, paymentId });
}

export async function getShopifyEffectivePaymentMethods(merchant: {
  id: string;
  paypal_enabled?: boolean | null;
  has_usd_account?: boolean | null;
}) {
  const [config, usdAccount] = await Promise.all([
    getPaymentProviderConfig(),
    PayPalService.getMerchantUsdAccountState(merchant),
  ]);
  const moncash = config.active_provider === 'bazik'
    || config.paym_moncash_web
    || config.paym_moncash_ussd;
  const natcash = config.active_provider === 'bazik'
    ? config.sms_gateway_enabled
    : config.paym_natcash_web;
  return [
    { id: 'moncash', label: 'MonCash', enabled: moncash, currency: 'HTG' },
    { id: 'natcash', label: 'NatCash', enabled: natcash, currency: 'HTG' },
    { id: 'card', label: 'Carte bancaire', enabled: usdAccount.isActive, currency: 'USD' },
    { id: 'paypal', label: 'PayPal', enabled: usdAccount.isActive, currency: 'USD' },
    { id: 'wallet', label: 'Apple Pay / Google Pay', enabled: usdAccount.isActive, currency: 'USD' },
  ];
}
