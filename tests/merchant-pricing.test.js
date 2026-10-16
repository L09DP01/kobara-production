import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOCAL_PAYMENT_FEE_PERCENT, DASHBOARD_DAILY_WITHDRAWAL_LIMIT_HTG, MERCHANT_ACCESS, isWithdrawalAmountAllowed } from '../src/lib/merchant-pricing.ts';

test('merchant access no longer depends on a paid subscription', () => {
  assert.equal(LOCAL_PAYMENT_FEE_PERCENT, 3.9);
  assert.equal(DASHBOARD_DAILY_WITHDRAWAL_LIMIT_HTG, 50000);
  assert.equal(MERCHANT_ACCESS.canUsePaidFeatures, true);
  assert.equal(MERCHANT_ACCESS.currentPeriodEnd, null);
});
test('each withdrawal has the same 75k ceiling, including USD conversion', () => {
  assert.equal(isWithdrawalAmountAllowed(75000, 'HTG', 130), true);
  assert.equal(isWithdrawalAmountAllowed(75000.01, 'HTG', 130), false);
  assert.equal(isWithdrawalAmountAllowed(500, 'USD', 150), true);
  assert.equal(isWithdrawalAmountAllowed(501, 'USD', 150), false);
  for (const n of [NaN, Infinity, -1, 0]) assert.equal(isWithdrawalAmountAllowed(n, 'HTG', 130), false);
  assert.equal(isWithdrawalAmountAllowed(10, 'USD', 0), false);
});
test('daily quota is dashboard-only, and KYC remains mandatory for Live', () => {
  const access = readFileSync('src/lib/server/access.ts', 'utf8');
  assert.match(access, /source !== 'dashboard'/);
  assert.match(access, /kyc_status !== 'approved'/);
  assert.doesNotMatch(access, /getMonthlyPaymentCount|getApiKeysCount|activateFreePlanAfterKyc/);
});
test('old subscription purchases and renewal routes are retired', () => {
  for (const file of ['src/app/api/dashboard/billing/upgrade/route.ts', 'src/app/api/mobile/subscriptions/[id]/renew-balance/route.ts', 'src/app/api/mobile/subscriptions/[id]/renew-moncash/route.ts', 'src/app/api/mobile/subscriptions/[id]/renew-natcash/route.ts']) {
    const route = readFileSync(file, 'utf8');
    assert.match(route, /SUBSCRIPTIONS_RETIRED/);
    assert.match(route, /status: 410/);
    assert.doesNotMatch(route, /purchase_subscription|createPaymentGateway/);
  }
});
