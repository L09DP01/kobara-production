import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCreditMerchantReferralReward,
  calculateDeveloperCommission,
  getDeveloperCommissionRate,
  getDeveloperTier,
  isMerchantReferralQualified,
} from '../src/lib/partners/program-rules.ts';

test('developer tiers follow active merchant thresholds', () => {
  assert.equal(getDeveloperTier(0), 'developer');
  assert.equal(getDeveloperTier(4), 'developer');
  assert.equal(getDeveloperTier(5), 'partner');
  assert.equal(getDeveloperTier(20), 'pro_partner');
  assert.equal(getDeveloperTier(50), 'agency');
});

test('agency commission requires an explicit admin override', () => {
  assert.equal(getDeveloperCommissionRate('developer'), 10);
  assert.equal(getDeveloperCommissionRate('partner'), 30);
  assert.equal(getDeveloperCommissionRate('pro_partner'), 50);
  assert.equal(getDeveloperCommissionRate('agency'), null);
  assert.equal(getDeveloperCommissionRate('agency', 62.5), 62.5);
});

test('developer commission uses only the Kobara one-percent revenue', () => {
  assert.equal(calculateDeveloperCommission(10_000, 10), 10);
  assert.equal(calculateDeveloperCommission(10_000, 30), 30);
  assert.equal(calculateDeveloperCommission(10_000, 50), 50);
});

test('merchant referral needs Pro and one independent currency threshold', () => {
  assert.equal(isMerchantReferralQualified({ hasActiveProPlan: false, htgTotal: 20_000, usdTotal: 100 }), false);
  assert.equal(isMerchantReferralQualified({ hasActiveProPlan: true, htgTotal: 9_999, usdTotal: 49.99 }), false);
  assert.equal(isMerchantReferralQualified({ hasActiveProPlan: true, htgTotal: 10_000, usdTotal: 0 }), true);
  assert.equal(isMerchantReferralQualified({ hasActiveProPlan: true, htgTotal: 0, usdTotal: 50 }), true);
});

test('merchant referral reward also requires 1500 HTG of referrer payment volume', () => {
  assert.equal(canCreditMerchantReferralReward({ invitedMerchantQualified: true, referrerHtgTotal: 1499.99 }), false);
  assert.equal(canCreditMerchantReferralReward({ invitedMerchantQualified: false, referrerHtgTotal: 5000 }), false);
  assert.equal(canCreditMerchantReferralReward({ invitedMerchantQualified: true, referrerHtgTotal: 1500 }), true);
});
