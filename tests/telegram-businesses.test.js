import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = '20000000-0000-4000-8000-000000000001';
const child = '20000000-0000-4000-8000-000000000002';
const other = '20000000-0000-4000-8000-000000000003';
const user = '10000000-0000-4000-8000-000000000001';

function load(file, mocks) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => id in mocks ? mocks[id] : require(id), module, module.exports);
  return module.exports;
}

function fixture() {
  const merchants = [
    { id: root, user_id: user, role: 'owner', business_name: 'Academie fictive', current_environment: 'live' },
    { id: child, user_id: user, role: 'owner', business_name: 'Atelier <test>', current_environment: 'test' },
    { id: other, user_id: 'another-user', role: 'developer', business_name: 'Autre compte' },
  ];
  const link = { id: 'unit-link', telegram_chat_id: '123', merchant_id: root, merchants: merchants[0], session_state: {}, updated_at: '2020-01-01T00:00:00Z' };
  const rows = { merchant_telegram_accounts: [link], merchants, users: [{ id: user, is_active: true }] };
  const messages = []; const creations = [];
  let conflict = false;
  const db = { from(table) {
    let filters = []; let patch;
    const q = {
      select() { return q; }, eq(key, value) { filters.push(r => r[key] === value); return q; },
      is(key, value) { filters.push(r => (r[key] ?? null) === value); return q; },
      update(value) { patch = value; return q; },
      async maybeSingle() {
        const row = rows[table].find(r => filters.every(f => f(r)));
        if (!row || (patch && conflict)) return { data: null, error: null };
        if (patch) Object.assign(row, structuredClone(patch));
        return { data: structuredClone(row), error: null };
      },
    };
    return q;
  } };
  const mocks = {
    'server-only': {}, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/server/merchant-context': {
      getAccessibleMerchants: async () => structuredClone(merchants),
      isMerchantId: value => typeof value === 'string' && /^20000000-0000-4000-8000-00000000000[123]$/.test(value),
    },
    '@/lib/business-name': load('../src/lib/business-name.ts', {}),
    '@/lib/business-creation-error': {},
    './telegram-client': { TelegramClient: { sendMessage: async (chat, text, options) => { messages.push({ chat, text, options }); } } },
  };
  const { businessSchema } = load('../src/lib/server/create-business.ts', mocks);
  const api = load('../src/lib/server/telegram/telegram-businesses.ts', {
    ...mocks, '@/lib/server/create-business': { businessSchema, createOwnedBusiness: async (...args) => {
      creations.push(args); return { success: true, merchantId: child };
    } },
  });
  return { ...api, rows, link, messages, creations, conflict: () => { conflict = true; } };
}

test('one Telegram link switches only owned businesses, clears financial state and preserves the original anchor', async () => {
  const h = fixture();
  h.link.session_state = { step: 'withdraw_otp', amount: 500, receiver: 'unit-destination' };
  await h.TelegramBusinesses.switch(123, child);
  assert.equal(h.link.merchant_id, root);
  assert.deepEqual(h.link.session_state, { active_merchant_id: child });
  assert.equal((await h.getTelegramBusinessAccount(123)).merchant.id, child);
  await h.saveTelegramBusinessState(123, { step: 'link_amount' });
  assert.equal(h.link.session_state.active_merchant_id, child);
  await h.TelegramBusinesses.switch(123, other);
  assert.equal(h.link.session_state.active_merchant_id, child);
  assert.match(h.messages.at(-1).text, /pas autorisé/);
  await h.TelegramBusinesses.show(123);
  const buttons = h.messages.at(-1).options.reply_markup.inline_keyboard.flat();
  assert.ok(buttons.some(b => b.callback_data === `business:switch:${child}`));
  assert.ok(!buttons.some(b => b.callback_data === `business:switch:${other}`));
  assert.match(h.messages.at(-1).text, /Atelier &lt;test&gt;/);
});

test('forged, deleted or transferred selections and deactivated users never fall back into another business', async () => {
  const h = fixture();
  h.link.session_state = { active_merchant_id: other };
  assert.equal(await h.getTelegramBusinessAccount(123), null);
  h.link.session_state = { active_merchant_id: 'forged' };
  assert.equal(await h.getTelegramBusinessAccount(123), null);
  h.link.session_state = { active_merchant_id: child };
  h.rows.merchants.find(m => m.id === child).user_id = 'another-user';
  assert.equal(await h.getTelegramBusinessAccount(123), null);
  h.link.session_state = {};
  h.rows.users[0].is_active = false;
  assert.equal(await h.getTelegramBusinessAccount(123), null);
});

test('Telegram creation validates each field and requires confirmation, keeping the authenticated owner and source', async () => {
  const h = fixture();
  await h.TelegramBusinesses.startCreate(123);
  await h.TelegramBusinesses.step(123, 'x', structuredClone(h.link.session_state));
  assert.equal(h.link.session_state.field, 0);
  for (const value of ['Atelier fictif', 'services', '+50940000000', 'Adresse fictive', 'Services de formation et assistance numerique', 'aucun']) {
    await h.TelegramBusinesses.step(123, value, structuredClone(h.link.session_state));
  }
  assert.equal(h.link.session_state.step, 'business_confirm');
  assert.equal(h.creations.length, 0);
  assert.match(h.messages.at(-1).text, /\/confirmer/);
  await h.TelegramBusinesses.step(123, 'oui', structuredClone(h.link.session_state));
  assert.equal(h.creations.length, 0);
  await h.TelegramBusinesses.step(123, '/confirmer', structuredClone(h.link.session_state));
  assert.equal(h.creations.length, 1);
  assert.deepEqual(h.creations[0].slice(0, 2), [user, root]);
  assert.equal(h.creations[0][2].website, '');
  assert.match(h.creations[0][2].requestId, /^[a-f0-9-]{36}$/);
  assert.deepEqual(h.link.session_state, { active_merchant_id: child });
  assert.equal(h.link.merchant_id, root);
});

test('stale conversations cannot continue after switching and concurrent state writes fail closed', async () => {
  const h = fixture();
  await h.TelegramBusinesses.startCreate(123);
  const old = structuredClone(h.link.session_state);
  await h.TelegramBusinesses.switch(123, child);
  await h.TelegramBusinesses.step(123, '/confirmer', old);
  assert.equal(h.creations.length, 0);
  await assert.rejects(h.saveTelegramBusinessState(123, { step: 'withdraw_otp', active_merchant_id: root }), /telegram_business_changed/);
  h.conflict();
  await assert.rejects(h.saveTelegramBusinessState(123, { step: 'link_amount' }), /telegram_session_changed/);
});
