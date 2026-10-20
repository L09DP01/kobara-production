import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { createHmac } from 'node:crypto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canCollectShopifyOrder, isMatchingShopifyPayment, shopifyOrderAmount, shopifyOrderId } from '../src/lib/shopify-policy.ts';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const sample = { id: 42, currency: 'HTG', total_price: '250.00', financial_status: 'pending', payment_gateway_names: ['Kobara'], test: false };

// No production credentials, messages, payments or stores are used by this suite.
process.env.SHOPIFY_CLIENT_ID = 'shopify-test-client';
process.env.SHOPIFY_CLIENT_SECRET = 'shopify-test-placeholder-not-a-real-secret';
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = 'shopify-test-placeholder-encryption-only';
process.env.SHOPIFY_APP_URL = 'https://dashboard.example';

function database(seed = {}) {
  const tables = { merchants: [{ id: 'merchant-a', kyc_status: 'approved', current_environment: 'live' }], ...structuredClone(seed) };
  const value = (row, key) => key.includes('->>') ? row[key.split('->>')[0]]?.[key.split('->>')[1]] : row[key];
  const db = { tables, from(table) {
    tables[table] ||= [];
    const q = { filters: [], operation: 'select', one: false,
      select() { return this; }, eq(k, v) { this.filters.push(row => value(row, k) === v); return this; },
      is(k, v) { this.filters.push(row => (row[k] ?? null) === v); return this; },
      in(k, values) { this.filters.push(row => values.includes(row[k])); return this; },
      insert(data) { this.operation = 'insert'; this.data = data; return this; },
      upsert(data, options) { this.operation = 'upsert'; this.data = data; this.conflict = options?.onConflict; return this; },
      update(data) { this.operation = 'update'; this.data = data; return this; },
      delete() { this.operation = 'delete'; return this; }, order() { return this; }, limit() { return this; },
      single() { this.one = true; return this.run(); }, maybeSingle() { this.one = true; return this.run(); },
      then(resolve, reject) { return this.run().then(resolve, reject); },
      async run() {
        let rows = tables[table].filter(row => this.filters.every(filter => filter(row)));
        if (this.operation === 'insert' || this.operation === 'upsert') {
          let existing = this.operation === 'upsert' && this.conflict
            ? tables[table].find(row => this.conflict.split(',').every(key => row[key] === this.data[key])) : null;
          if (table === 'payment_links' && tables[table].some(row => row.metadata?.shopify_installation_id === this.data.metadata?.shopify_installation_id && row.metadata?.shopify_order_id === this.data.metadata?.shopify_order_id)) {
            return { data: null, error: { code: '23505' } };
          }
          if (table === 'shopify_webhook_receipts' && tables[table].some(row => row.webhook_id === this.data.webhook_id)) return { data: null, error: { code: '23505' } };
          if (existing) Object.assign(existing, structuredClone(this.data));
          else { existing = { id: `${table}-${tables[table].length + 1}`, kobara_status: 'observed', status: table === 'shopify_webhook_receipts' ? 'processing' : undefined, ...structuredClone(this.data) }; tables[table].push(existing); }
          rows = [existing];
        } else if (this.operation === 'update') rows.forEach(row => Object.assign(row, structuredClone(this.data)));
        else if (this.operation === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
        return { data: structuredClone(this.one ? rows[0] || null : rows), error: null };
      },
    };
    return q;
  } };
  return db;
}

function load(file, mocks = {}) {
  const compiled = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

function service(db) {
  const emails = [];
  const api = load('src/lib/server/shopify.ts', {
    'server-only': {}, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/shopify-policy': { canCollectShopifyOrder, isMatchingShopifyPayment, shopifyOrderAmount, shopifyOrderId },
    '@/lib/server/payments/gateway': {}, '@/lib/server/payments/paypal': {},
    '@/lib/server/mail': { sendEmail: async email => { emails.push(email); return { success: true }; } },
  });
  return { api, emails };
}
const installation = { id: 'installation-a', merchant_id: 'merchant-a', shop_domain: 'test-shop.myshopify.com', status: 'active' };

test('only an unpaid live HTG order choosing Kobara can generate a collection', () => {
  assert.equal(canCollectShopifyOrder(sample), true);
  for (const change of [{ test: true }, { cancelled_at: '2026-01-01' }, { currency: 'USD' }, { financial_status: 'paid' }, { financial_status: 'partially_paid' }, { financial_status: 'refunded' }, { total_price: '-1' }, { payment_gateway_names: ['Cash on Delivery'] }, { payment_gateway_names: [] }]) assert.equal(canCollectShopifyOrder({ ...sample, ...change }), false);
  assert.equal(shopifyOrderAmount({ ...sample, current_total_price: '0' }), 0);
  assert.equal(shopifyOrderId({ admin_graphql_api_id: 'gid://shopify/Order/42' }), '42');
  assert.throws(() => shopifyOrderId({ id: 'https://attacker.example' }));
});

test('OAuth validates domains, HMAC, signed state expiry and token encryption', async () => {
  const { api } = service(database());
  assert.equal(api.normalizeShopDomain('https://Test-Shop.myshopify.com/'), 'test-shop.myshopify.com');
  for (const shop of ['shop.myshopify.com.attacker.example', 'localhost:3000', 'https://attacker.example', 'shop.myshopify.com?evil=1']) assert.throws(() => api.normalizeShopDomain(shop));
  const params = new URLSearchParams({ shop: 'test-shop.myshopify.com', code: 'test-code', timestamp: '123' });
  const signature = createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update('code=test-code&shop=test-shop.myshopify.com&timestamp=123').digest('hex');
  params.set('hmac', signature);
  assert.equal(api.verifyShopifyOAuthHmac(params), true);
  params.set('shop', 'other.myshopify.com');
  assert.equal(api.verifyShopifyOAuthHmac(params), false);
  const state = await api.createShopifyOAuthState({ merchantId: 'merchant-a', shopDomain: installation.shop_domain, nonce: 'one-time-test' });
  assert.equal((await api.verifyShopifyOAuthState(state)).merchantId, 'merchant-a');
  await assert.rejects(api.verifyShopifyOAuthState(state + 'tampered'));
  const encrypted = api.encryptShopifyAccessToken('fake-access-for-unit-test');
  assert.equal(api.decryptShopifyAccessToken(encrypted), 'fake-access-for-unit-test');
  assert.notEqual(encrypted, api.encryptShopifyAccessToken('fake-access-for-unit-test'));
  const url = new URL(api.buildShopifyAuthorizationUrl(installation.shop_domain, state));
  assert.equal(url.searchParams.get('scope'), 'read_orders,write_orders');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://dashboard.example/api/integrations/shopify/callback');
});

test('a working connection is not destroyed when a new OAuth connection is requested', async () => {
  const db = database({ shopify_installations: [{ ...installation, access_token_ciphertext: 'retained' }] });
  const { api } = service(db);
  await assert.rejects(api.prepareShopifyOAuthConnection({ merchantId: 'merchant-a', shopDomain: installation.shop_domain }), /already_connected/);
  assert.equal(db.tables.shopify_installations[0].access_token_ciphertext, 'retained');
});

test('Shopify write_orders includes read_orders in both scope validation and token exchange', async t => {
  const { api } = service(database());
  assert.equal(api.hasRequiredShopifyScopes(['write_orders']), true);
  assert.equal(api.hasRequiredShopifyScopes(['read_orders']), false);
  assert.equal(api.hasRequiredShopifyScopes(['write_products']), false);
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).expiring, 1);
    return Response.json({ access_token: 'fake-unit-test-access', scope: 'write_orders',
      refresh_token: 'fake-unit-test-refresh', expires_in: 3600, refresh_token_expires_in: 7776000 });
  };
  assert.deepEqual((await api.exchangeShopifyAuthorizationCode(installation.shop_domain, 'unit-test-code')).scopes, ['write_orders']);
  global.fetch = async () => Response.json({ access_token: 'fake-unit-test-access', scope: 'read_orders' });
  await assert.rejects(api.exchangeShopifyAuthorizationCode(installation.shop_domain, 'unit-test-code'), /missing_scopes/);
  global.fetch = async () => Response.json({ error: 'sensitive-upstream-description' }, { status: 401 });
  await assert.rejects(api.exchangeShopifyAuthorizationCode(installation.shop_domain, 'unit-test-code'), /^Error: oauth_token_http_401$/);
  global.fetch = async () => Response.json({ access_token: 'fake-unit-test-access', scope: 'write_orders' });
  await assert.rejects(api.exchangeShopifyAuthorizationCode(installation.shop_domain, 'unit-test-code'), /oauth_expiring_token_missing/);
});

test('expiring tokens are encrypted, refreshed before expiry and never restored after disconnect', async t => {
  const db = database({ shopify_installations: [{ ...installation }] });
  const { api } = service(db);
  const row = db.tables.shopify_installations[0];
  row.access_token_ciphertext = api.encryptShopifyTokenSet({ accessToken: 'fake-old-access', refreshToken: 'fake-old-refresh',
    expiresAt: Date.now() + 30000, refreshExpiresAt: Date.now() + 3600000 });
  assert.doesNotMatch(row.access_token_ciphertext, /fake-old/);
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let calls = 0;
  global.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.redirect, 'manual');
    assert.equal(JSON.parse(init.body).grant_type, 'refresh_token');
    assert.equal(JSON.parse(init.body).refresh_token, 'fake-old-refresh');
    return Response.json({ access_token: 'fake-new-access', refresh_token: 'fake-new-refresh', expires_in: 3600, refresh_token_expires_in: 7776000 });
  };
  assert.equal(await api.getShopifyAccessToken(installation), 'fake-new-access');
  assert.equal(await api.getShopifyAccessToken(installation), 'fake-new-access');
  assert.equal(calls, 1);
  const stored = JSON.parse(api.decryptShopifyAccessToken(row.access_token_ciphertext));
  assert.equal(stored.refreshToken, 'fake-new-refresh');
  row.access_token_ciphertext = api.encryptShopifyTokenSet({ ...stored, expiresAt: Date.now() - 1 });
  global.fetch = async () => {
    row.status = 'disconnected'; row.access_token_ciphertext = null;
    return Response.json({ access_token: 'fake-stale-access', refresh_token: 'fake-stale-refresh', expires_in: 3600, refresh_token_expires_in: 7776000 });
  };
  await assert.rejects(api.getShopifyAccessToken(installation), /inactive/);
  assert.equal(row.access_token_ciphertext, null);
});

test('OAuth diagnostic preserves runtime errors but redacts secrets, callback values and URLs', () => {
  const { api } = service(database());
  const sensitiveCode = 'single-use-unit-code';
  const detail = api.safeShopifyOAuthFailure(new TypeError(`fetch failed ${process.env.SHOPIFY_CLIENT_SECRET} ${sensitiveCode} https://example.com/token?code=private`), [sensitiveCode]);
  assert.match(detail, /TypeError: fetch failed/);
  assert.doesNotMatch(detail, /shopify-test-placeholder|single-use-unit-code|example.com|code=private/);
  assert.ok(detail.length <= 200);
});

test('Shopify HTTP calls use edge-compatible manual redirects and reject redirect responses', async t => {
  const { api } = service(database());
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  let calls = 0;
  global.fetch = async (_url, init) => {
    calls++;
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/token' } });
  };
  await assert.rejects(api.exchangeShopifyAuthorizationCode(installation.shop_domain, 'unit-test-code'), /oauth_token_http_302/);
  await assert.rejects(api.shopifyGraphql({ shopDomain: installation.shop_domain, accessToken: 'fake-unit-test-access', query: 'query { shop { id } }' }), /Erreur API Shopify \(302\)/);
  assert.equal(calls, 2);
});

test('GraphQL diagnostics expose only status and allowlisted error codes, not upstream messages', async t => {
  const { api } = service(database());
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async () => Response.json({ errors: [
    { message: 'private upstream data', extensions: { code: 'ACCESS_DENIED' } },
    { message: 'private upstream data', extensions: { code: 'https://untrusted.example/private' } },
  ] });
  await assert.rejects(api.shopifyGraphql({ shopDomain: installation.shop_domain, accessToken: 'fake-unit-test-access', query: 'query { shop { id } }' }), /^Error: Erreur API Shopify \(200\)\. ACCESS_DENIED$/);
});

test('duplicate order webhooks reuse the stored link and do not email twice', async () => {
  const db = database();
  const { api, emails } = service(db);
  const input = { installation, payload: { ...sample, email: 'unit-test@example.com' } };
  await api.ensureShopifyOrderPaymentLink(input);
  await api.ensureShopifyOrderPaymentLink(input);
  assert.equal(db.tables.payment_links.length, 1);
  assert.equal(emails.length, 1);
  assert.match(emails[0].text, new RegExp(db.tables.payment_links[0].slug));
  assert.ok(emails[0].idempotencyKey);
  assert.equal(db.tables.payment_links[0].environment, 'live');
  assert.ok(Date.parse(db.tables.payment_links[0].expires_at) > Date.now());
});

test('simultaneous order webhooks recover the winning slug after a unique-index conflict', async () => {
  const db = database();
  const { api, emails } = service(db);
  await Promise.all([1, 2].map(() => api.ensureShopifyOrderPaymentLink({ installation, payload: { ...sample, email: 'unit-test@example.com' } })));
  assert.equal(db.tables.payment_links.length, 1);
  assert.equal(emails.length, 1);
  assert.equal(db.tables.shopify_orders[0].checkout_url, `https://pay.kobara.app/${db.tables.payment_links[0].slug}`);
});

test('test merchants, unverified merchants and Shopify Test orders never receive live payment links', async () => {
  for (const merchant of [{ current_environment: 'test', kyc_status: 'approved' }, { current_environment: 'live', kyc_status: 'pending' }]) {
    const db = database({ merchants: [{ id: 'merchant-a', ...merchant }] });
    await service(db).api.ensureShopifyOrderPaymentLink({ installation, payload: sample });
    assert.equal(db.tables.payment_links?.length || 0, 0);
  }
  const db = database();
  await service(db).api.ensureShopifyOrderPaymentLink({ installation, payload: { ...sample, test: true } });
  assert.equal(db.tables.payment_links?.length || 0, 0);
});

test('cancellation, a changed order amount or another gateway disables a previously issued link', async () => {
  for (const change of [{ cancelled_at: '2026-10-20T10:00:00Z' }, { current_total_price: '300' }, { payment_gateway_names: ['cash'] }]) {
    const db = database();
    const { api } = service(db);
    await api.ensureShopifyOrderPaymentLink({ installation, payload: sample });
    await api.ensureShopifyOrderPaymentLink({ installation, payload: { ...sample, ...change } });
    assert.equal(db.tables.payment_links.length, 1);
    assert.equal(db.tables.payment_links[0].status, 'inactive');
  }
});

test('payment correlation rejects Test, wrong merchant, wrong link, wrong amount, currency or cancelled order', () => {
  const p = { id: 'payment-a', merchant_id: 'merchant-a', payment_link_id: 'link-a', status: 'succeeded', environment: 'live', currency: 'HTG', amount: 250 };
  const order = { merchant_id: 'merchant-a', payment_link_id: 'link-a', total_amount: 250, currency: 'HTG', kobara_status: 'payment_link_ready' };
  assert.equal(isMatchingShopifyPayment(p, order), true);
  for (const change of [{ environment: 'test' }, { status: 'pending' }, { merchant_id: 'other' }, { payment_link_id: 'other' }, { amount: 249 }, { currency: 'USD' }]) assert.equal(isMatchingShopifyPayment({ ...p, ...change }, order), false);
  assert.equal(isMatchingShopifyPayment(p, { ...order, kobara_status: 'cancelled' }), false);
});

test('Test payments and disconnected installations cannot invoke Shopify orderMarkAsPaid', async t => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('External calls forbidden in unit tests'); };
  t.after(() => { global.fetch = original; });
  const p = { id: 'payment-a', merchant_id: 'merchant-a', payment_link_id: 'link-a', status: 'succeeded', environment: 'test', amount: 250, currency: 'HTG' };
  const order = { id: 'order-a', installation_id: installation.id, shopify_order_id: '42', merchant_id: 'merchant-a', payment_link_id: 'link-a', total_amount: 250, currency: 'HTG', kobara_status: 'payment_link_ready' };
  const db = database({ payments: [p], shopify_orders: [order], shopify_installations: [{ ...installation, status: 'disconnected' }] });
  const { api } = service(db);
  await api.markShopifyOrderPaid({ installationId: installation.id, orderGid: 'gid://shopify/Order/42', paymentId: p.id });
  db.tables.payments[0].environment = 'live';
  await assert.rejects(api.markShopifyOrderPaid({ installationId: installation.id, orderGid: 'gid://shopify/Order/42', paymentId: p.id }), /inactive/);
  assert.equal(calls, 0);
});

test('successful live confirmation is idempotent and closes the payment link', async t => {
  const db = database({ payments: [{ id: 'payment-a', merchant_id: 'merchant-a', payment_link_id: 'link-a', status: 'succeeded', environment: 'live', amount: 250, currency: 'HTG' }], shopify_orders: [{ id: 'order-a', installation_id: installation.id, shopify_order_id: '42', merchant_id: 'merchant-a', payment_link_id: 'link-a', total_amount: 250, currency: 'HTG', kobara_status: 'payment_link_ready' }], payment_links: [{ id: 'link-a', merchant_id: 'merchant-a', status: 'active' }] });
  const { api } = service(db);
  db.tables.shopify_installations = [{ ...installation, access_token_ciphertext: api.encryptShopifyAccessToken('fake-access-for-unit-test') }];
  const original = global.fetch;
  let mutations = 0;
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    if (body.query.includes('KobaraOrderBeforePayment')) return Response.json({ data: { order: { id: 'gid://shopify/Order/42', cancelledAt: null, displayFinancialStatus: 'PENDING', currentTotalPriceSet: { shopMoney: { amount: '250', currencyCode: 'HTG' } } } } });
    mutations++;
    return Response.json({ data: { orderMarkAsPaid: { order: { id: 'gid://shopify/Order/42', displayFinancialStatus: 'PAID' }, userErrors: [] } } });
  };
  t.after(() => { global.fetch = original; });
  await api.reconcileShopifyPayment('payment-a', 'link-a');
  await api.reconcileShopifyPayment('payment-a', 'link-a');
  assert.equal(mutations, 1);
  assert.equal(db.tables.shopify_orders[0].payment_id, 'payment-a');
  assert.equal(db.tables.payment_links[0].status, 'inactive');
});

test('webhook signatures require the raw original body', () => {
  const { api } = service(database());
  const raw = JSON.stringify(sample);
  const signature = createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(raw).digest('base64');
  assert.equal(api.verifyShopifyWebhookHmac(raw, signature), true);
  assert.equal(api.verifyShopifyWebhookHmac(raw + ' ', signature), false);
  assert.equal(api.verifyShopifyWebhookHmac(raw, null), false);
});

test('migration keeps tokens private and enforces installation, order, link and webhook uniqueness', () => {
  const sql = read('supabase/migrations/20260828165318_shopify_connect.sql');
  for (const table of ['shopify_installations', 'shopify_orders', 'shopify_webhook_receipts']) {
    assert.match(sql, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON public\\.${table} FROM PUBLIC, anon, authenticated`));
  }
  assert.match(sql, /UNIQUE \(merchant_id\)/);
  assert.match(sql, /UNIQUE \(installation_id, shopify_order_id\)/);
  assert.match(sql, /webhook_id TEXT NOT NULL UNIQUE/);
  assert.match(sql, /idx_payment_links_shopify_order_unique/);
});

test('desktop and mobile share Shopify navigation and contain no old plan entitlement', () => {
  const sidebar = read('src/components/dashboard/sidebar.tsx');
  assert.match(sidebar, /href: "\/integrations\/shopify".*ownerOnly: true.*requiresKyc: true/);
  assert.equal((sidebar.match(/<SidebarContent/g) || []).length, 2);
  for (const file of ['src/app/dashboard/integrations/shopify/page.tsx', 'src/app/api/integrations/shopify/callback/route.ts', 'src/app/api/integrations/shopify/disconnect/route.ts', 'src/app/api/integrations/shopify/webhooks/route.ts']) assert.doesNotMatch(read(file), /plan Pro|Pro offert|applyShopifyProEntitlement|Premium|abonnement/i);
});

const nextResponse = {
  json: (body, init) => Response.json(body, init),
  redirect: (url, status = 307) => new Response(null, { status, headers: { Location: String(url) } }),
};

function webhookRequest(id, payload = sample, topic = 'orders/create', signed = true) {
  const raw = JSON.stringify(payload);
  return new Request('https://dashboard.example/api/integrations/shopify/webhooks', {
    method: 'POST', body: raw,
    headers: { 'x-shopify-webhook-id': id, 'x-shopify-shop-domain': installation.shop_domain, 'x-shopify-topic': topic,
      'x-shopify-hmac-sha256': signed ? createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(raw).digest('base64') : 'invalid' },
  });
}

test('all compliance topics reject invalid HMAC before accessing the database', async () => {
  const { api } = service(database());
  const route = load('src/app/api/integrations/shopify/webhooks/route.ts', {
    'next/server': { NextResponse: nextResponse },
    '@/utils/supabase/admin': { createAdminClient: () => { throw new Error('Database must not be accessed'); } },
    '@/lib/server/shopify': api,
  });
  for (const topic of ['customers/data_request', 'customers/redact', 'shop/redact']) {
    const request = webhookRequest(`invalid-${topic}`, {}, topic, false);
    assert.equal((await route.POST(request)).status, 401);
    const missing = webhookRequest(`missing-${topic}`, {}, topic);
    missing.headers.delete('x-shopify-hmac-sha256');
    assert.equal((await route.POST(missing)).status, 401);
    const changed = webhookRequest(`changed-${topic}`, { changed: true }, topic);
    changed.headers.set('x-shopify-hmac-sha256', createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update('{}').digest('base64'));
    assert.equal((await route.POST(changed)).status, 401);
  }
});

test('Shopify app configuration declares all mandatory privacy topics without changing access scopes', () => {
  const config = read('shopify.app.toml');
  assert.match(config, /scopes = "read_orders,write_orders"/);
  assert.match(config, /compliance_topics = \["customers\/data_request", "customers\/redact", "shop\/redact"\]/);
  assert.match(config, /uri = "https:\/\/dashboard.kobara.app\/api\/integrations\/shopify\/webhooks"/);
  assert.doesNotMatch(config, /client_secret|encryption_key|access_token/i);
});

test('the real webhook route authenticates, deduplicates and retries a failed delivery', async () => {
  const db = database({ shopify_installations: [installation] });
  const { api } = service(db);
  let calls = 0;
  const route = load('src/app/api/integrations/shopify/webhooks/route.ts', {
    'next/server': { NextResponse: nextResponse }, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/server/shopify': { ...api, ensureShopifyOrderPaymentLink: async () => { calls++; if (calls === 1) throw new Error('temporary database failure'); } },
  });
  assert.equal((await route.POST(webhookRequest('test-delivery', sample, 'orders/create', false))).status, 401);
  assert.equal(db.tables.shopify_webhook_receipts?.length || 0, 0);
  assert.equal((await route.POST(webhookRequest('test-delivery'))).status, 503);
  assert.equal(db.tables.shopify_webhook_receipts[0].status, 'failed');
  assert.equal((await route.POST(webhookRequest('test-delivery'))).status, 200);
  assert.equal(db.tables.shopify_webhook_receipts[0].status, 'processed');
  assert.equal((await route.POST(webhookRequest('test-delivery'))).status, 200);
  assert.equal(calls, 2);
});

test('uninstallation deletes the credential and disables outstanding collection links', async () => {
  const db = database({ shopify_installations: [{ ...installation, access_token_ciphertext: 'unit-test-placeholder' }], payment_links: [{ id: 'link-a', merchant_id: 'merchant-a', status: 'active', metadata: { shopify_installation_id: installation.id } }] });
  const { api } = service(db);
  const route = load('src/app/api/integrations/shopify/webhooks/route.ts', {
    'next/server': { NextResponse: nextResponse }, '@/utils/supabase/admin': { createAdminClient: () => db }, '@/lib/server/shopify': api,
  });
  assert.equal((await route.POST(webhookRequest('uninstall-delivery', {}, 'app/uninstalled'))).status, 200);
  assert.equal(db.tables.shopify_installations[0].access_token_ciphertext, null);
  assert.equal(db.tables.shopify_installations[0].status, 'uninstalled');
  assert.equal(db.tables.payment_links[0].status, 'inactive');
});

test('disconnect validates the origin and owner session, clears credentials and deactivates links', async () => {
  const db = database({ shopify_installations: [{ ...installation, access_token_ciphertext: 'unit-test-placeholder' }], payment_links: [{ id: 'link-a', merchant_id: 'merchant-a', status: 'active', metadata: { shopify_installation_id: installation.id } }] });
  const route = load('src/app/api/integrations/shopify/disconnect/route.ts', {
    'next/server': { NextResponse: nextResponse }, '@/lib/server/shopify-auth': { requireShopifyOwnerMerchant: async () => ({ merchant: { id: 'merchant-a' }, supabase: db }) },
  });
  const request = origin => ({ headers: new Headers({ origin }), nextUrl: new URL('https://dashboard.example/api/integrations/shopify/disconnect'), url: 'https://dashboard.example/api/integrations/shopify/disconnect' });
  assert.equal((await route.POST(request('https://attacker.example'))).status, 403);
  assert.equal(db.tables.shopify_installations[0].status, 'active');
  assert.equal((await route.POST(request('https://dashboard.example'))).status, 303);
  assert.equal(db.tables.shopify_installations[0].status, 'disconnected');
  assert.equal(db.tables.shopify_installations[0].access_token_ciphertext, null);
  assert.equal(db.tables.payment_links[0].status, 'inactive');
});

test('a retried uninstall still closes links after the installation was already deactivated', async () => {
  const db = database({ shopify_installations: [{ ...installation, status: 'uninstalled', access_token_ciphertext: null }], payment_links: [{ id: 'link-a', merchant_id: 'merchant-a', status: 'active', metadata: { shopify_installation_id: installation.id } }] });
  const { api } = service(db);
  const route = load('src/app/api/integrations/shopify/webhooks/route.ts', {
    'next/server': { NextResponse: nextResponse }, '@/utils/supabase/admin': { createAdminClient: () => db }, '@/lib/server/shopify': api,
  });
  assert.equal((await route.POST(webhookRequest('uninstall-retry', {}, 'app/uninstalled'))).status, 200);
  assert.equal(db.tables.payment_links[0].status, 'inactive');
});

test('OAuth callback requires a verified merchant, validates scopes and consumes its nonce once', async () => {
  const db = database();
  const { api } = service(db);
  const nonce = 'callback-unit-test';
  const state = await api.createShopifyOAuthState({ merchantId: 'merchant-a', shopDomain: installation.shop_domain, nonce });
  db.tables.shopify_installations = [{ ...installation, status: 'pending', oauth_state_hash: api.hashShopifyOAuthNonce(nonce) }];
  let exchanged = 0;
  const route = load('src/app/api/integrations/shopify/callback/route.ts', {
    'next/server': { NextResponse: nextResponse }, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/server/shopify': { ...api,
      exchangeShopifyAuthorizationCode: async () => { exchanged++; return { accessToken: 'fake-unit-test-access', refreshToken: 'fake-unit-test-refresh', expiresAt: Date.now() + 3600000, refreshExpiresAt: Date.now() + 7776000000, scopes: ['write_orders'] }; },
      getShopifyShopIdentity: async () => ({ id: 'gid://shopify/Shop/1', name: 'Unit test', email: null, myshopifyDomain: installation.shop_domain }),
      registerShopifyWebhooks: async () => [],
    },
  });
  const params = new URLSearchParams({ code: 'unit-test-code', shop: installation.shop_domain, state });
  const message = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  params.set('hmac', createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET).update(message).digest('hex'));
  const request = { nextUrl: new URL(`https://dashboard.example/api/integrations/shopify/callback?${params}`) };
  const response = await route.GET(request);
  assert.equal(new URL(response.headers.get('location')).searchParams.get('connected'), '1');
  assert.equal(db.tables.shopify_installations[0].status, 'active');
  assert.equal(db.tables.shopify_installations[0].oauth_state_hash, null);
  assert.equal(await api.getShopifyAccessToken(installation), 'fake-unit-test-access');
  const replay = await route.GET(request);
  assert.equal(new URL(replay.headers.get('location')).searchParams.get('error'), 'callback_failed');
  assert.equal(exchanged, 1);
});

test('Shopify callback defaults never inherit the unrelated NEXTAUTH_URL', () => {
  const original = process.env.SHOPIFY_APP_URL;
  const authUrl = process.env.NEXTAUTH_URL;
  try {
    delete process.env.SHOPIFY_APP_URL;
    process.env.NEXTAUTH_URL = 'http://kobara.app';
    const { api } = service(database());
    assert.equal(api.getShopifyConfig().redirectUrl, 'https://dashboard.kobara.app/api/integrations/shopify/callback');
  } finally {
    if (original === undefined) delete process.env.SHOPIFY_APP_URL;
    else process.env.SHOPIFY_APP_URL = original;
    if (authUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = authUrl;
  }
});

test('merchant Shopify screen renders connected, disconnected and KYC-blocked states without subscriptions', async () => {
  for (const connected of [false, true]) {
    const db = database({ shopify_installations: connected ? [{ ...installation, shop_name: 'Unit test shop', granted_scopes: ['read_orders', 'write_orders'] }] : [] });
    const page = load('src/app/dashboard/integrations/shopify/page.tsx', {
      'next/navigation': { redirect: () => { throw new Error('redirect'); } },
      '@/components/shopify-kobara-lockup': { ShopifyKobaraLockup: () => React.createElement('span', null, 'Shopify / Kobara') },
      '@/utils/supabase/auth-helper': { getCurrentUserAndMerchant: async () => ({ merchant: db.tables.merchants[0], userRole: 'owner' }) },
      '@/utils/supabase/admin': { createAdminClient: () => db },
    });
    const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
    assert.match(html, /Dernières commandes/);
    assert.doesNotMatch(html, /Pro offert|Premium|abonnement/i);
    if (connected) {
      assert.match(html, /Déconnecter/);
      assert.match(html, /<details\b[^>]*\bopen=""/);
      assert.match(html, /Finaliser la configuration dans Shopify/);
      assert.match(html, /\/admin\/settings\/payments/);
      assert.match(html, /saisissez exactement|Saisissez exactement/);
      assert.match(html, /sans redirection automatique/);
      assert.match(html, /help.shopify.com\/fr\/manual\/payments\/manual-payments/);
    }
    else {
      assert.doesNotMatch(html, /Finaliser la configuration dans Shopify/);
      assert.match(html, /name="shop"/);
      db.tables.merchants[0].kyc_status = 'pending';
      const blocked = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({}) }));
      assert.match(blocked, /disabled=""/);
      assert.match(blocked, /compte doit être vérifié/);
    }
  }
});
