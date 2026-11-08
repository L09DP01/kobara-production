import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { fetchPaymBalance, ProviderBalanceError } from '../src/lib/server/paym/paym-balance.ts';

const payload = (overrides = {}) => ({ success: true, data: {
  entreprise: 'Compte fournisseur de test', balance: 12500, available_balance: 11800,
  currency: 'HTG', is_active: true, ...overrides,
} });
const json = (value, status = 200) => Response.json(value, { status });
const config = { baseUrl: 'https://provider.example/', getToken: async () => 'test-placeholder' };

test('withdrawal provider authentication uses a Workers-compatible redirect policy', () => {
  const service = fs.readFileSync(new URL('../src/lib/server/paym/paym.service.ts', import.meta.url), 'utf8');
  const auth = service.slice(service.indexOf('async getAuthToken('), service.indexOf('const data = await response.json()', service.indexOf('async getAuthToken(')));
  assert.match(auth, /redirect:\s*'manual'/);
  assert.doesNotMatch(auth, /redirect:\s*'error'/);
  assert.match(auth, /if \(!response.ok\)/);
});

test('balance redirects are refused without forwarding the bearer token', async () => {
  let calls = 0;
  await assert.rejects(fetchPaymBalance({ ...config, fetcher: async (_url, init) => {
    calls++;
    assert.equal(init.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.example/' } });
  } }), ProviderBalanceError);
  assert.equal(calls, 1);
});

test('treasury requests the documented endpoint without caching or redirects and returns only approved fields', async () => {
  const result = await fetchPaymBalance({ ...config, fetcher: async (url, init) => {
    assert.equal(url, 'https://provider.example/api/marchand/balance');
    assert.equal(init.method, 'GET');
    assert.equal(init.headers.Authorization, 'Bearer test-placeholder');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(init.cache, 'no-store');
    assert.equal(init.redirect, 'manual');
    assert.ok(init.signal instanceof AbortSignal);
    return json({ ...payload(), token: 'must-not-be-returned' });
  } });
  assert.equal(result.total, 12500);
  assert.equal(result.available, 11800);
  assert.equal(result.currency, 'HTG');
  assert.equal(result.active, true);
  assert.ok(Number.isFinite(Date.parse(result.checkedAt)));
  assert.equal('token' in result, false);
});

test('valid zero balances and decimal strings are not mistaken for missing funds', async () => {
  const result = await fetchPaymBalance({ ...config, fetcher: async () => json(payload({ balance: '0.00', available_balance: '0', is_active: false })) });
  assert.equal(result.total, 0);
  assert.equal(result.available, 0);
  assert.equal(result.active, false);
});

test('an expired merchant token is refreshed once', async () => {
  const refresh = [];
  let calls = 0;
  await fetchPaymBalance({ ...config, getToken: async force => { refresh.push(force); return 'test-placeholder'; },
    fetcher: async () => ++calls === 1 ? json({}, 401) : json(payload()),
  });
  assert.deepEqual(refresh, [false, true]);
  assert.equal(calls, 2);
});

test('repeated authentication refusal stops after one retry', async () => {
  let calls = 0;
  await assert.rejects(fetchPaymBalance({ ...config, fetcher: async () => { calls++; return json({}, 401); } }),
    error => error instanceof ProviderBalanceError && error.code === 'authentication');
  assert.equal(calls, 2);
});

test('missing account and provider downtime do not produce invented zero balances', async () => {
  for (const [status, code] of [[404, 'not_found'], [403, 'unavailable'], [500, 'unavailable']]) {
    await assert.rejects(fetchPaymBalance({ ...config, fetcher: async () => json({}, status) }), error => error.code === code);
  }
});

test('malformed, incomplete and failed payloads are rejected without exposing the provider response', async () => {
  for (const response of [
    { success: false, data: payload().data }, {}, payload({ balance: null }),
    payload({ balance: '' }), payload({ available_balance: -1 }), payload({ balance: 'NaN' }),
    payload({ is_active: 'true' }), payload({ currency: '' }),
  ]) {
    await assert.rejects(fetchPaymBalance({ ...config, fetcher: async () => json(response) }), error => error.code === 'invalid_response');
  }
  await assert.rejects(fetchPaymBalance({ ...config, fetcher: async () => new Response('private-provider-error') }),
    error => error.code === 'invalid_response' && !error.message.includes('private-provider-error'));
});

test('network and authentication errors are sanitized', async () => {
  const fail = async () => { throw new Error('secret-provider-detail'); };
  for (const overrides of [{ fetcher: fail }, { getToken: fail }]) {
    await assert.rejects(fetchPaymBalance({ ...config, ...overrides }), error => error.code === 'unavailable' && !error.message.includes('secret-provider-detail'));
  }
});

test('treasury authorizes the administrator before reading the supplier balance', () => {
  const page = fs.readFileSync(new URL('../src/app/system-core/(protected)/treasury/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /requireAdmin\(\['super_admin', 'operations'\]\)/);
  assert.ok(page.indexOf('await requireAdmin(') < page.indexOf('await PaymService.getBalance()'));
  assert.doesNotMatch(page, /PAYM_CLIENT_SECRET|marchand_token|Authorization/);
  const shell = fs.readFileSync(new URL('../src/app/system-core/(protected)/admin-shell.tsx', import.meta.url), 'utf8');
  assert.match(shell, /href: "\/system-core\/treasury"/);
});
