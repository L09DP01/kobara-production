import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateSubscriptionEntitlement, pickSubscriptionForEntitlement } from '../src/lib/server/subscription-entitlement.ts';

const now = new Date('2026-08-10T12:00:00.000Z');

function subscription(overrides = {}) {
  return {
    id: 'subscription-id',
    merchant_id: 'merchant-id',
    plan_id: 'plan-id',
    status: 'active',
    billing_cycle: 'monthly',
    amount_htg: 1750,
    current_period_start: '2026-07-10T12:00:00.000Z',
    current_period_end: '2026-09-10T12:00:00.000Z',
    cancel_at_period_end: false,
    plan: {
      id: 'plan-id', slug: 'pro', name: 'Pro', description: null, price_htg: 1750,
      monthly_payment_limit: null, api_keys_limit: null, transaction_fee_percent: 2.9,
      daily_withdrawal_limit: 20000, wordpress_plugin: true, webhooks_level: 'advanced',
      analytics_level: 'standard', support_level: 'priority_email', is_contact_sales: false,
      features: [], limits: {}, status: 'active', sort_order: 2,
    },
    ...overrides,
  };
}

test('no subscription falls back to free without paid access', () => {
  const result = evaluateSubscriptionEntitlement(null, now);
  assert.equal(result.effectivePlan, 'free');
  assert.equal(result.canUsePaidFeatures, false);
});

test('active paid subscription with a future period is entitled', () => {
  const result = evaluateSubscriptionEntitlement(subscription(), now);
  assert.equal(result.effectivePlan, 'pro');
  assert.equal(result.canUsePaidFeatures, true);
});

test('period ending exactly now is expired immediately', () => {
  const result = evaluateSubscriptionEntitlement(subscription({ current_period_end: now.toISOString() }), now);
  assert.equal(result.isExpired, true);
  assert.equal(result.effectivePlan, 'free');
});

test('future period does not override an inactive status', () => {
  const result = evaluateSubscriptionEntitlement(subscription({ status: 'canceled' }), now);
  assert.equal(result.canUsePaidFeatures, false);
  assert.equal(result.reason, 'inactive');
});

test('paid subscription without period end is invalid and disabled', () => {
  const result = evaluateSubscriptionEntitlement(subscription({ current_period_end: null }), now);
  assert.equal(result.canUsePaidFeatures, false);
  assert.equal(result.reason, 'invalid_period');
});

test('pending or unknown paid activation never grants premium access', () => {
  const result = evaluateSubscriptionEntitlement(subscription({ payment_status: 'pending' }), now);
  assert.equal(result.canUsePaidFeatures, false);
  assert.equal(result.reason, 'payment_unconfirmed');
});

test('free plan may have a null period end', () => {
  const result = evaluateSubscriptionEntitlement(subscription({
    amount_htg: 0,
    current_period_end: null,
    plan: { ...subscription().plan, slug: 'free', name: 'Gratuit', price_htg: 0 },
  }), now);
  assert.equal(result.reason, 'free');
  assert.equal(result.isActive, true);
  assert.equal(result.canUsePaidFeatures, false);
});

test('explicit five-day grace period keeps paid access temporarily', () => {
  const result = evaluateSubscriptionEntitlement(subscription({
    current_period_end: '2026-08-05T12:00:00.000Z',
    grace_period_end: '2026-08-15T12:00:00.000Z',
  }), now);
  assert.equal(result.isGracePeriod, true);
  assert.equal(result.canUsePaidFeatures, true);
});

test('expired grace period falls back to free', () => {
  const result = evaluateSubscriptionEntitlement(subscription({
    current_period_end: '2026-08-01T12:00:00.000Z',
    grace_period_end: '2026-08-09T12:00:00.000Z',
  }), now);
  assert.equal(result.isExpired, true);
  assert.equal(result.canUsePaidFeatures, false);
});

test('cancel at period end keeps access until the paid date', () => {
  const result = evaluateSubscriptionEntitlement(subscription({ cancel_at_period_end: true }), now);
  assert.equal(result.canUsePaidFeatures, true);
});

test('a new paid subscription reactivates any plan after an old subscription expired', () => {
  const oldExpired = subscription({
    id: 'old-subscription',
    status: 'expired',
    current_period_end: '2026-08-01T12:00:00.000Z',
  });
  const newBusiness = subscription({
    id: 'new-subscription',
    current_period_start: '2026-08-10T12:00:00.000Z',
    current_period_end: '2026-09-10T12:00:00.000Z',
    plan: { ...subscription().plan, slug: 'business', name: 'Business', price_htg: 3500 },
  });

  const selected = pickSubscriptionForEntitlement([newBusiness, oldExpired], now);
  assert.equal(selected?.plan.slug, 'business');
  assert.equal(evaluateSubscriptionEntitlement(selected, now).canUsePaidFeatures, true);
});
