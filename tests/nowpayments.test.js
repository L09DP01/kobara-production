import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertPaymentAmountToUsd,
  CRYPTO_PAYMENT_WINDOW_MS,
  getCryptoPaymentExpiresAt,
  getCryptoWithdrawalMinimumUsd,
  isKobaraCryptoCurrency,
  signNowPaymentsPayload,
  sortObjectDeep,
  verifyNowPaymentsSignature,
} from '../src/lib/nowpayments.ts';

test('NOWPayments payload sorting is recursive and preserves arrays', () => {
  assert.deepEqual(sortObjectDeep({ z: 1, a: { y: 2, b: 3 }, list: [{ z: 1, a: 2 }] }), {
    a: { b: 3, y: 2 },
    list: [{ a: 2, z: 1 }],
    z: 1,
  });
});

test('NOWPayments IPN signatures are verified without leaking the secret', () => {
  const payload = { payment_status: 'finished', payment_id: 42, order_id: 'payment-1' };
  const signature = signNowPaymentsPayload(payload, 'test-secret');
  assert.equal(verifyNowPaymentsSignature(payload, signature, 'test-secret'), true);
  assert.equal(verifyNowPaymentsSignature({ ...payload, payment_id: 43 }, signature, 'test-secret'), false);
  assert.equal(verifyNowPaymentsSignature(payload, 'invalid', 'test-secret'), false);
});

test('HTG crypto invoices are quoted in USD using the configured rate', () => {
  assert.equal(convertPaymentAmountToUsd(13_000, 'HTG', 130), 100);
  assert.equal(convertPaymentAmountToUsd(49.99, 'USD', 130), 49.99);
});

test('only the approved crypto and network tickers are accepted', () => {
  for (const ticker of ['btc', 'eth', 'trx', 'ton', 'bnbbsc', 'usdttrc20', 'usdterc20', 'usdc', 'usdtbsc', 'pyusd', 'usdcbsc']) {
    assert.equal(isKobaraCryptoCurrency(ticker), true);
  }
  assert.equal(isKobaraCryptoCurrency('ltc'), false);
  assert.equal(isKobaraCryptoCurrency('usdcsol'), false);
});

test('crypto withdrawal minimums match the network policy', () => {
  assert.equal(getCryptoWithdrawalMinimumUsd('trx'), 10);
  assert.equal(getCryptoWithdrawalMinimumUsd('ton'), 10);
  assert.equal(getCryptoWithdrawalMinimumUsd('bnbbsc'), 10);
  assert.equal(getCryptoWithdrawalMinimumUsd('btc'), 25);
  assert.equal(getCryptoWithdrawalMinimumUsd('usdterc20'), 50);
});

test('crypto checkout expires no later than twenty minutes after creation', () => {
  const now = Date.parse('2026-09-17T12:00:00.000Z');
  assert.equal(CRYPTO_PAYMENT_WINDOW_MS, 20 * 60 * 1000);
  assert.equal(
    getCryptoPaymentExpiresAt(null, now),
    '2026-09-17T12:20:00.000Z',
  );
  assert.equal(
    getCryptoPaymentExpiresAt('2026-09-17T12:45:00.000Z', now),
    '2026-09-17T12:20:00.000Z',
  );
  assert.equal(
    getCryptoPaymentExpiresAt('2026-09-17T12:15:00.000Z', now),
    '2026-09-17T12:15:00.000Z',
  );
});
