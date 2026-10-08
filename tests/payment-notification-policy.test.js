import assert from 'node:assert/strict';
import test from 'node:test';
import { getPayerReceiptEmail, shouldNotifyMerchantPayment } from '../src/lib/payment-notification-policy.ts';

test('only successful live payment links notify the merchant', () => {
  const payment = { status: 'succeeded', environment: 'live', payment_link_id: 'link-id' };
  assert.equal(shouldNotifyMerchantPayment(payment), true);
  for (const overrides of [{ status: 'pending' }, { status: 'failed' }, { environment: 'test' }, { payment_link_id: null }, { metadata: { is_subscription_upgrade: true } }]) {
    assert.equal(shouldNotifyMerchantPayment({ ...payment, ...overrides }), false);
  }
});

test('receipts use payer email and never generic metadata email', () => {
  assert.equal(getPayerReceiptEmail({ customer_email: ' payer@example.com ' }), 'payer@example.com');
  assert.equal(getPayerReceiptEmail({ email: 'merchant@example.com' }), null);
  assert.equal(getPayerReceiptEmail({}, 'payer@example.com'), 'payer@example.com');
});

test('omitted or invalid checkout email does not fall back to stale customer email', () => {
  for (const customer_email of [null, '', 'bad-email', 'payer@example.com\nBcc: other@example.com']) {
    assert.equal(getPayerReceiptEmail({ customer_email }, 'old@example.com'), null);
  }
});
