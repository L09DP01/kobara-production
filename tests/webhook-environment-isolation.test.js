import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWebhookEventKey,
  buildWebhookPayload,
  filterWebhookEndpoints,
} from '../src/lib/webhooks.ts';

const endpoints = [
  { id: 'test-a', merchant_id: 'merchant-a', environment: 'test', status: 'active' },
  { id: 'live-a', merchant_id: 'merchant-a', environment: 'live', status: 'active' },
  { id: 'test-b', merchant_id: 'merchant-b', environment: 'test', status: 'active' },
  { id: 'disabled', merchant_id: 'merchant-a', environment: 'test', status: 'disabled' },
];

test('a test event is delivered only to active test endpoints of its merchant', () => {
  assert.deepEqual(
    filterWebhookEndpoints(endpoints, 'merchant-a', 'test').map(({ id }) => id),
    ['test-a'],
  );
});

test('a live event is never delivered to a test endpoint', () => {
  assert.deepEqual(
    filterWebhookEndpoints(endpoints, 'merchant-a', 'live').map(({ id }) => id),
    ['live-a'],
  );
});

test('manual test and resend target only the requested endpoint', () => {
  assert.deepEqual(
    filterWebhookEndpoints(endpoints, 'merchant-a', 'test', 'test-a').map(({ id }) => id),
    ['test-a'],
  );
  assert.deepEqual(filterWebhookEndpoints(endpoints, 'merchant-a', 'test', 'live-a'), []);
});

test('the signed payload exposes one consistent environment', () => {
  const payload = buildWebhookPayload('payment.succeeded', 'live', { id: 'payment-1' }, 123);
  assert.equal(payload.environment, 'live');
  assert.equal(payload.data.environment, 'live');
});

test('idempotency keys are isolated by endpoint and environment', () => {
  assert.notEqual(
    buildWebhookEventKey('merchant-a', 'endpoint-a', 'test', 'payment.succeeded:payment-1'),
    buildWebhookEventKey('merchant-a', 'endpoint-a', 'live', 'payment.succeeded:payment-1'),
  );
  assert.equal(buildWebhookEventKey('merchant-a', 'endpoint-a', 'test', null), null);
});
