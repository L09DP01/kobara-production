import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getPaymentMethodLabel,
  getSettlementAmounts,
  resolveSettlementCurrency,
  withSettlementAuditMetadata,
} from '../src/lib/payment-settlement.ts';

test('an HTG quote settled by crypto is recorded in USD', () => {
  const payment = {
    amount: 1_443,
    fee_amount: 43.29,
    net_amount: 1_399.71,
    currency: 'HTG',
    amount_usd: 11.1,
    fee_amount_usd: 0.33,
    net_amount_usd: 10.77,
    provider: 'crypto',
    payment_method: 'trx',
  };

  assert.equal(resolveSettlementCurrency(payment), 'USD');
  assert.deepEqual(getSettlementAmounts(payment), {
    currency: 'USD',
    gross: 11.1,
    fee: 0.33,
    net: 10.77,
  });
  assert.equal(getPaymentMethodLabel(payment), 'Crypto (TRX)');
});

test('local wallet settlements remain in HTG', () => {
  const payment = {
    amount: 150,
    fee_amount: 6,
    net_amount: 144,
    currency: 'HTG',
    provider: 'moncash',
    payment_method: 'moncash_ussd',
  };

  assert.deepEqual(getSettlementAmounts(payment), {
    currency: 'HTG',
    gross: 150,
    fee: 6,
    net: 144,
  });
  assert.equal(getPaymentMethodLabel(payment), 'MonCash');
});

test('missing USD mirrors fall back to the primary settled values', () => {
  assert.deepEqual(getSettlementAmounts({
    amount: 12,
    fee_amount: 1,
    net_amount: 11,
    currency: 'USD',
    provider: 'paypal',
    amount_usd: null,
    fee_amount_usd: null,
    net_amount_usd: null,
  }), {
    currency: 'USD',
    gross: 12,
    fee: 1,
    net: 11,
  });
});

test('settlement metadata preserves the original quote', () => {
  const metadata = withSettlementAuditMetadata({
    amount: 1_443,
    fee_amount: 43.29,
    net_amount: 1_399.71,
    currency: 'HTG',
    metadata: { order: 'A-1' },
  }, 'USD');

  assert.deepEqual(metadata.original_quote, {
    amount: 1_443,
    fee_amount: 43.29,
    net_amount: 1_399.71,
    currency: 'HTG',
  });
  assert.equal(metadata.settlement_currency, 'USD');
  assert.equal(metadata.order, 'A-1');
});
