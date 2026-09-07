import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/20260907210554_fix_subscription_balance_ledger.sql', import.meta.url),
  'utf8',
);
const upgradeRoute = readFileSync(
  new URL('../src/app/api/dashboard/billing/upgrade/route.ts', import.meta.url),
  'utf8',
);

test('subscription purchases use aggregate balance instead of withdrawable funds', () => {
  assert.match(migration, /SELECT available_balance INTO v_balance/);
  assert.doesNotMatch(migration, /get_merchant_funds_availability/);
});

test('subscription purchases and renewals write complete withdrawal history rows', () => {
  assert.equal((migration.match(/INSERT INTO public\.withdrawals/g) || []).length, 2);
  assert.equal((migration.match(/exchange_rate, payout_amount, balance_reserved_at/g) || []).length, 2);
  assert.equal((migration.match(/'system_subscription'/g) || []).length, 2);
  assert.equal((migration.match(/payout_amount[\s\S]*?NULL,[\s\S]*?jsonb_build_object/g) || []).length, 2);
  assert.match(migration, /'purpose', 'subscription_purchase'/);
  assert.match(migration, /'purpose', 'subscription_renewal'/);
});

test('subscription balance functions remain restricted to the service role', () => {
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.renew_subscription_from_balance\(UUID\)[\s\S]*?FROM PUBLIC, anon, authenticated/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.purchase_subscription_from_balance\(UUID, UUID, TEXT, NUMERIC, TEXT\) TO service_role/);
});

test('billing API does not expose raw database errors to merchants', () => {
  assert.doesNotMatch(upgradeRoute, /Impossible d’activer le plan: \$\{error\.message\}/);
  assert.match(upgradeRoute, /subscription_balance_purchase_failed/);
});
