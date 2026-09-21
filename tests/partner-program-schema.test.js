import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const foundation = readFileSync(
  new URL('../supabase/migrations/20260920223336_partner_program_foundation.sql', import.meta.url),
  'utf8',
);
const completion = readFileSync(
  new URL('../supabase/migrations/20260920235900_complete_partner_program.sql', import.meta.url),
  'utf8',
);
const teamAccess = readFileSync(
  new URL('../supabase/migrations/20260921220000_unify_developer_team_access.sql', import.meta.url),
  'utf8',
);
const migration = `${foundation}\n${completion}\n${teamAccess}`;

test('partner financial RPCs are exposed only to the server service role', () => {
  const rpcNames = [
    'accept_developer_invitation',
    'accept_merchant_referral',
    'request_partner_withdrawal',
    'review_partner_withdrawal',
    'release_partner_commissions',
    'accept_merchant_developer_invitation',
  ];

  for (const name of rpcNames) {
    assert.match(migration, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\(`));
    assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${name}\\([^;]+FROM PUBLIC, anon, authenticated;`));
    assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${name}\\([^;]+TO service_role;`));
  }
});

test('merchant team Developer access is explicitly excluded from commissions', () => {
  assert.match(teamAccess, /connection_source TEXT NOT NULL DEFAULT 'developer_referral'/);
  assert.match(teamAccess, /commission_eligible BOOLEAN NOT NULL DEFAULT TRUE/);
  assert.match(teamAccess, /'merchant_invitation', FALSE/);
  assert.match(teamAccess, /connection_source = 'merchant_invitation'/);
  assert.match(teamAccess, /commission_eligible = FALSE/);
});

test('attribution remains unique and immutable per merchant', () => {
  assert.match(migration, /merchant_id UUID PRIMARY KEY/);
  assert.match(migration, /merchant_attribution_already_exists/);
  assert.match(migration, /ON CONFLICT \(merchant_id\) DO NOTHING/);
});

test('partner withdrawals reserve balances atomically', () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /SET status = 'pending', partner_withdrawal_id = v_withdrawal_id/);
  assert.match(migration, /partner_withdrawal_id = v_withdrawal_id/);
  assert.match(migration, /partner_withdrawal_insufficient_balance/);
});

test('merchant referral rewards credit and reverse the real merchant balance', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.credit_merchant_referral_reward/);
  assert.match(migration, /UPDATE public\.merchants/);
  assert.match(migration, /available_balance_usd = COALESCE\(available_balance_usd, 0\) - NEW\.amount/);
  assert.match(migration, /available_balance = COALESCE\(available_balance, 0\) - NEW\.amount/);
});
