import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('../src/app/system-core/(protected)/layout.tsx');
const transactions = read('../src/app/system-core/(protected)/transactions/page.tsx');
const transactionDetail = read('../src/app/system-core/(protected)/transactions/[id]/page.tsx');
const transactionActions = read('../src/app/system-core/(protected)/transactions/actions.ts');
const merchantDetail = read('../src/app/system-core/(protected)/merchants/[id]/page.tsx');

test('pending payment corrections are authenticated, live-only and audited', () => {
  assert.ok(transactionActions.indexOf("requireAdmin(['super_admin', 'operations'])") < transactionActions.indexOf("value(formData, 'payment_id'"));
  assert.match(transactionActions, /\.eq\('environment', 'live'\)/);
  assert.match(transactionActions, /\.eq\('status', 'pending'\)/);
  assert.match(transactionActions, /action: 'payment\.pending_corrected'/);
  assert.doesNotMatch(transactionActions, /const changes = \{[\s\S]*?provider:/);
  assert.doesNotMatch(transactionActions, /const changes = \{[\s\S]*?(?:amount|fee_amount|net_amount|status):/);
});

test('the pencil action is rendered only for pending payments in System Core', () => {
  for (const source of [transactions, transactionDetail, merchantDetail]) {
    assert.match(source, /status === 'pending'[\s\S]*?<Pencil/);
    assert.match(source, /\/system-core\/transactions\/\$\{(?:p\.)?id\}\?edit=1/);
  }
});

test('System Core shell and ledgers remain usable on narrow screens', () => {
  assert.match(layout, /md:hidden/);
  assert.match(layout, /overflow-x-hidden/);
  assert.match(layout, /p-3 sm:p-5 md:p-8/);

  const ledgers = [
    '../src/app/system-core/(protected)/transactions/page.tsx',
    '../src/app/system-core/(protected)/merchants/page.tsx',
    '../src/app/system-core/(protected)/merchants/[id]/page.tsx',
    '../src/app/system-core/(protected)/withdrawals/withdrawals-admin-client.tsx',
    '../src/app/system-core/(protected)/subscriptions/page.tsx',
    '../src/app/system-core/(protected)/sessions/page.tsx',
    '../src/app/system-core/(protected)/support/page.tsx',
    '../src/app/system-core/(protected)/audit/page.tsx',
    '../src/app/system-core/(protected)/messaging/messaging-client.tsx',
    '../src/app/system-core/(protected)/sms-gateway/page.tsx',
  ];

  for (const path of ledgers) {
    const source = read(path);
    assert.match(source, /overflow-x-auto/, `${path} needs a horizontal scroll container`);
    assert.match(source, /min-w-\[\d+px\]/, `${path} needs a stable table width`);
  }
});
