import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function harness(withdrawal) {
  const filters = [];
  const query = table => ({
    select() { return this; },
    eq(key, value) { filters.push([table, key, value]); return this; },
    maybeSingle: async () => ({ data: table === 'withdrawals' ? withdrawal : { business_name: 'Boutique Demo' }, error: null }),
  });
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/server/email/withdrawal-receipt.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id === 'server-only') return {};
    if (id === '@/utils/supabase/admin') return { createAdminClient: () => ({ from: query }) };
    throw Error(`Unexpected import ${id}`);
  }, module, module.exports);
  return { build: module.exports.getWithdrawalReceiptPresentation, filters };
}

test('withdrawal receipt reads scoped real details and actual status', async () => {
  const h = harness({ id: 'w1', status: 'completed', amount: 2500, currency: 'HTG', kobara_reference: 'WTH-REAL-1', provider: 'moncash', completed_at: '2026-10-25T14:30:00Z' });
  const data = await h.build('m1', 'w1');
  assert.equal(data.operation, 'withdrawal');
  assert.equal(data.status, 'succeeded');
  assert.equal(data.amount, 2500);
  assert.equal(data.reference, 'WTH-REAL-1');
  assert.equal(data.method, 'MonCash');
  assert.equal(data.merchantName, 'Boutique Demo');
  assert.match(data.date, /25 octobre 2026/);
  assert.ok(h.filters.some(([table, key, value]) => table === 'withdrawals' && key === 'merchant_id' && value === 'm1'));
});

test('approval and missing rows never become successful withdrawals', async () => {
  const h = harness({ id: 'w1', status: 'approved', amount: 10, currency: 'USD' });
  assert.equal((await h.build('m1', 'w1')).status, 'approved');
  assert.equal(await harness(null).build('m1', 'w1'), undefined);
  assert.equal(await h.build('m1'), undefined);
});
