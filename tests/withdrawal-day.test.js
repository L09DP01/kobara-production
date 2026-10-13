import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getWithdrawalDayBounds } from '../src/lib/withdrawal-day.ts';

test('UTC midnight does not reset the Haitian withdrawal day', () => {
  assert.deepEqual(getWithdrawalDayBounds(new Date('2026-10-14T00:00:00Z')), {
    start: '2026-10-13T04:00:00.000Z', end: '2026-10-14T04:00:00.000Z',
  });
});

test('the quota resets exactly at midnight in Haiti', () => {
  const before = getWithdrawalDayBounds(new Date('2026-10-14T03:59:59.999Z'));
  const after = getWithdrawalDayBounds(new Date('2026-10-14T04:00:00Z'));
  assert.equal(before.end, after.start);
  assert.equal(after.start, '2026-10-14T04:00:00.000Z');
});

test('winter midnight uses the current Haitian UTC offset', () => {
  assert.equal(getWithdrawalDayBounds(new Date('2026-01-01T12:00:00Z')).start, '2026-01-01T05:00:00.000Z');
});

test('DST boundaries produce 23-hour and 25-hour calendar days', () => {
  for (const [instant, hours] of [['2026-03-08T12:00:00Z', 23], ['2026-11-01T12:00:00Z', 25]]) {
    const { start, end } = getWithdrawalDayBounds(new Date(instant));
    assert.equal(Date.parse(end) - Date.parse(start), hours * 3_600_000);
  }
});

test('calendar rollover works across months and years', () => {
  assert.equal(getWithdrawalDayBounds(new Date('2026-12-31T12:00:00Z')).end, '2027-01-01T05:00:00.000Z');
});

test('SQL quota enforcement and fallback use the same timezone', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261013223802_haitian_daily_withdrawal_limits.sql', import.meta.url), 'utf8');
  const usage = readFileSync(new URL('../src/lib/server/usage.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(sql, /AT TIME ZONE 'UTC'/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /v_used \+ v_requested > v_limit/);
  assert.match(sql, /w\.status NOT IN \('failed', 'rejected', 'cancelled'\)/);
  assert.match(sql, /system_subscription/);
  assert.match(sql, /w\.request_source = 'dashboard'/);
  assert.match(sql, /daily_withdrawal_limit = 20000 WHERE slug = 'pro'/);
  assert.match(usage, /const \{ start, end \} = getWithdrawalDayBounds\(\)/);
});

test('dashboard quota is explicit and never applied to public API requests', () => {
  const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const access = read('../src/lib/server/access.ts');
  const dashboard = read('../src/app/dashboard/withdrawals/actions.ts');
  const api = read('../src/app/api/v1/withdrawals/route.ts');
  const service = read('../src/lib/server/withdrawals/withdrawal.service.ts');
  assert.match(access, /source: 'dashboard' \| 'api' = 'api'/);
  assert.match(access, /source === 'dashboard' && access\.plan/);
  assert.match(dashboard, /canCreateWithdrawal\(merchant\.id, limitAmountHtg, 'dashboard'\)/);
  assert.match(dashboard, /requestSource: 'dashboard'/);
  assert.doesNotMatch(api, /requestSource: 'dashboard'/);
  assert.match(service, /requestSource === 'dashboard' \? 'prepare_dashboard_withdrawal' : 'prepare_automatic_withdrawal'/);
  assert.match(service, /DASHBOARD_QUOTA_UNAVAILABLE/);
});

test('expired subscriptions can renew their previous paid plan', () => {
  const billing = readFileSync(new URL('../src/app/dashboard/billing/billing-client.tsx', import.meta.url), 'utf8');
  assert.match(billing, /renewalPlan = subscription\?\.plan \|\| plan/);
  assert.match(billing, /handleUpgradeClick\(renewalPlan\)/);
});

test('subscription cron fails closed when its secret is missing', () => {
  const cron = readFileSync(new URL('../src/app/api/cron/subscriptions/route.ts', import.meta.url), 'utf8');
  assert.match(cron, /!process\.env\.CRON_SECRET \|\| authHeader !==/);
});
