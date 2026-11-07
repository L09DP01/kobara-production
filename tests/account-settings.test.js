import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function load(file, mocks = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports);
  return module.exports;
}
const policy = load('../src/lib/account-settings-policy.ts');
const row = (id, security_json = {}) => ({ merchant_id: id, security_json });

test('security is independent of the active business and reuses existing MFA', () => {
  const rows = [row('first'), row('second', { two_factor_method: 'totp' }), row('foreign', { account_user_id: 'owner' })];
  assert.equal(policy.selectAccountSecurityRow(rows, ['first', 'second'], 'owner').merchant_id, 'second');
});
test('account marker remains authoritative after disabling MFA', () => {
  const rows = [row('first', { two_factor_method: 'totp' }), row('second', { account_user_id: 'owner', two_factor_method: 'none' })];
  assert.equal(policy.selectAccountSecurityRow(rows, ['first', 'second'], 'owner').merchant_id, 'second');
});
test('legacy passkeys are preferred over an empty new business', () => {
  assert.equal(policy.selectAccountSecurityRow([row('first'), row('second', { passkeys: [{ id: 'key' }] })], ['first', 'second'], 'owner').merchant_id, 'second');
});
test('legacy selection is deterministic regardless of database ordering', () => {
  assert.equal(policy.selectAccountSecurityRow([row('second', { two_factor_method: 'email' }), row('first', { two_factor_method: 'email' })], ['first', 'second'], 'owner').merchant_id, 'first');
});
test('client settings never contain MFA secrets or credential public keys', () => {
  const value = policy.publicAccountSecurity({ two_factor_method: 'totp', totp_secret: 'fixture', pending_totp_secret: 'fixture', current_challenge: 'fixture', passkeys: [{ id: 'key', publicKey: 'fixture', counter: 7 }] });
  assert.deepEqual(value, { two_factor_method: 'totp', passkeys: [{ id: 'key', deviceType: undefined, backedUp: undefined, created_at: undefined }] });
});

function fixture() {
  const tables = {
    merchants: [{ id: 'first', user_id: 'owner' }, { id: 'second', user_id: 'owner' }, { id: 'foreign', user_id: 'other' }],
    settings: [row('first', { passkeys: [{ id: 'key', counter: 1 }] }), row('second', { two_factor_method: 'totp', passkeys: [{ id: 'key', counter: 9 }] }), row('foreign', { totp_secret: 'foreign-fixture' })],
    merchant_telegram_accounts: [{ id: 'link', merchant_id: 'second', telegram_chat_id: 'fixture-chat', notifications_enabled: true }, { id: 'foreign-link', merchant_id: 'foreign' }],
  };
  const db = { from(table) {
    let filters = [];
    const result = () => ({ data: structuredClone(tables[table].filter(item => filters.every(filter => filter(item)))), error: null });
    const query = {
      select() { return query; }, order() { return query; }, limit() { return query; },
      eq(key, value) { filters.push(item => item[key] === value); return query; },
      in(key, values) { filters.push(item => values.includes(item[key])); return query; },
      maybeSingle() { const value = result(); return Promise.resolve({ ...value, data: value.data[0] || null }); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return query;
  } };
  const api = load('../src/lib/server/account-settings.ts', {
    'server-only': {}, '@/auth': { auth: async () => ({ user: { id: 'owner' } }) },
    '@/utils/supabase/admin': { createAdminClient: () => db }, '@/lib/account-settings-policy': policy,
  });
  return { api, tables };
}
test('legacy credentials from owned businesses are combined with highest counter', async () => {
  const { api } = fixture();
  const account = await api.getAccountSecurity('owner');
  assert.equal(account.merchant.id, 'second');
  assert.equal(account.security.passkeys[0].counter, 9);
  assert.equal(account.security.totp_secret, undefined);
});
test('an established account does not resurrect a removed legacy passkey', async () => {
  const { api, tables } = fixture();
  tables.settings[1].security_json = { account_user_id: 'owner', passkeys: [] };
  assert.deepEqual((await api.getAccountSecurity('owner')).security.passkeys, []);
});
test('Telegram notification routing works for every owned business only', async () => {
  const { api } = fixture();
  assert.equal((await api.getMerchantAccountTelegramLink('first')).id, 'link');
  assert.equal((await api.getMerchantAccountTelegramLink('second')).id, 'link');
  assert.equal((await api.getMerchantAccountTelegramLink('foreign')).id, 'foreign-link');
});
test('account reads do not alter balances, merchant settings or legacy records', async () => {
  const { api, tables } = fixture();
  const before = structuredClone(tables);
  await api.getCurrentAccountSecurity();
  await api.getAccountTelegramLink('owner');
  assert.deepEqual(tables, before);
});
test('unknown account fails closed', async () => {
  await assert.rejects(fixture().api.getAccountSecurity('missing'), /account_settings_unavailable/);
});
test('global installation prompt is not mounted', () => {
  const source = fs.readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /PwaInstallPrompt/);
});
