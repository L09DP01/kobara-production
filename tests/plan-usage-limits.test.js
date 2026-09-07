import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../supabase/migrations/20260907214614_enforce_plan_usage_limits.sql');
const access = read('../src/lib/server/access.ts');
const usage = read('../src/lib/server/usage.ts');
const apiPayments = read('../src/app/api/v1/payments/route.ts');
const paymentLinkAction = read('../src/app/pay/[paymentLinkId]/actions.ts');
const paymentLinkPage = read('../src/app/pay/[paymentLinkId]/page.tsx');

test('database enforces every persisted plan limit atomically', () => {
  assert.match(migration, /CREATE TRIGGER enforce_payment_plan_limit_on_insert/);
  assert.match(migration, /CREATE TRIGGER enforce_api_key_plan_limit_on_insert/);
  assert.match(migration, /CREATE TRIGGER enforce_withdrawal_plan_limit_on_insert/);
  assert.equal((migration.match(/pg_catalog\.pg_advisory_xact_lock/g) || []).length, 3);
});

test('payment quota counts live merchant payments and excludes internal ledger movements', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.get_monthly_billable_payment_count/);
  assert.match(migration, /payment\.environment = 'live'/);
  assert.match(migration, /payment\.provider[\s\S]*<> 'b2b'/);
  assert.match(migration, /is_subscription_upgrade[\s\S]*<> 'true'/);
  assert.match(usage, /rpc\('get_monthly_billable_payment_count'/);
  assert.match(usage, /throw new Error\('payment_usage_unavailable'\)/);
});

test('API and public payment links return the numbered payment limit error', () => {
  for (const source of [apiPayments, paymentLinkAction]) {
    assert.match(source, /PAYMENT_LIMIT_REACHED/);
    assert.match(source, /payment_limit_reached/);
  }
  assert.match(apiPayments, /limit: accessCheck\.limit/);
  assert.match(apiPayments, /used: accessCheck\.used/);
  assert.match(paymentLinkPage, /paymentsBlocked=\{paymentsBlocked\}/);
});

test('withdrawal usage excludes subscription charges and avoids counting B2B twice', () => {
  assert.match(migration, /withdrawal\.provider[\s\S]*<> 'system_subscription'/);
  assert.match(migration, /transfer\.withdrawal_id IS NULL/);
  assert.match(usage, /rpc\('get_daily_plan_withdrawal_total'/);
});

test('database quota helpers and triggers are not callable by public roles', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.get_effective_plan_limits\(UUID\) FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.enforce_payment_plan_limit\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(access, /remaining: Math\.max\(0, limit - currentCount\)/);
});

test('deployment remains compatible until the quota migration is applied', () => {
  assert.match(usage, /isMissingQuotaFunction/);
  assert.match(usage, /PGRST202/);
  assert.match(usage, /payment\.payment_source\?\.toLowerCase\(\) !== 'b2b'/);
  assert.match(usage, /transfer\.withdrawal_id \? 0/);
  assert.match(usage, /throw new Error\('payment_usage_unavailable'\)/);
});
