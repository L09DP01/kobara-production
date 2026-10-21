import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';

const id = '12345678-1234-4234-8234-123456789abc';
function setup(currentStatus = 'pending', conflict = false) {
  const writes = [], audits = [], settled = [], filters = [];
  const db = { from(table) {
    let updating = false;
    const q = {
      select() { return q; },
      eq(key, value) { filters.push([key, value]); return q; },
      update(data) { updating = true; writes.push(data); return q; },
      async insert(data) { audits.push(data); return { error: null }; },
      async maybeSingle() { return { data: updating ? (conflict ? null : { id }) : { id, merchant_id: 'merchant', status: currentStatus }, error: null }; },
    };
    return q;
  } };
  const source = fs.readFileSync(new URL('../src/app/system-core/(protected)/transactions/actions.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  const mocks = {
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect(url) { throw new Error(url); } },
    '@/lib/auth/require-admin': { async requireAdmin(roles) { assert.deepEqual(roles, ['super_admin', 'operations']); return { user: { id: 'admin', email: 'admin@example.invalid' } }; } },
    '@/utils/supabase/admin': { createAdminClient() { return db; } },
    '@/lib/server/payments/on-payment-succeeded': { async onPaymentSucceeded(paymentId) { settled.push(paymentId); } },
  };
  new Function('require', 'module', 'exports', code)((key) => mocks[key], mod, mod.exports);
  return { run: mod.exports.updatePendingPayment, writes, audits, settled, filters };
}
function form(status = 'succeeded', confirmed = true) {
  const data = new FormData();
  data.set('payment_id', id); data.set('status', status);
  if (confirmed) data.set('confirmed', 'yes');
  data.set('amount', '1'); data.set('reference_code', 'tampered');
  return data;
}
test('success edits only status and paid_at, with settlement and audit', async () => {
  const state = setup();
  await assert.rejects(state.run(form()), /saved=1/);
  assert.deepEqual(Object.keys(state.writes[0]).sort(), ['paid_at', 'status']);
  assert.equal(state.writes[0].status, 'succeeded');
  assert.deepEqual(state.settled, [id]);
  assert.equal(state.audits[0].action, 'payment.status_corrected');
  assert.ok(state.filters.some(([k, v]) => k === 'status' && v === 'pending'));
});
test('failed payment never triggers successful settlement', async () => {
  const state = setup(); await assert.rejects(state.run(form('failed')), /saved=1/);
  assert.deepEqual(state.writes, [{ status: 'failed' }]); assert.deepEqual(state.settled, []);
});
test('invalid statuses and unconfirmed requests cannot write', async () => {
  for (const data of [form('refunded'), form('succeeded', false)]) {
    const state = setup(); await assert.rejects(state.run(data), /error=status/); assert.equal(state.writes.length, 0);
  }
});
test('settled payments and concurrent updates cannot be credited twice', async () => {
  const settled = setup('succeeded'); await assert.rejects(settled.run(form()), /not_pending/); assert.equal(settled.writes.length, 0);
  const conflict = setup('pending', true); await assert.rejects(conflict.run(form()), /update_failed/); assert.equal(conflict.settled.length, 0);
});
