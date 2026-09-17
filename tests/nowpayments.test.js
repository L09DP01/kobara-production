import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertPaymentAmountToUsd,
  CRYPTO_PAYMENT_WINDOW_MS,
  getCryptoPaymentExpiresAt,
  getCryptoPaymentOperationalMinimumUsd,
  getCryptoWithdrawalMinimumUsd,
  getPublicCryptoCheckoutError,
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

test('crypto checkout errors expose a useful minimum without leaking provider details', () => {
  assert.deepEqual(getPublicCryptoCheckoutError({
    code: 'BELOW_MINIMUM_PAYMENT_AMOUNT',
    details: {
      estimatedPayAmount: 10,
      minimumPayAmount: 25,
      payCurrency: 'trx',
      priceAmount: 1.19,
    },
  }), {
    code: 'BELOW_MINIMUM_PAYMENT_AMOUNT',
    message: 'Le montant minimum pour TRX est d’environ 2.98 USD.',
    status: 422,
  });
});

test('crypto checkout errors prefer the enforced USD minimum', () => {
  assert.deepEqual(getPublicCryptoCheckoutError({
    code: 'BELOW_MINIMUM_PAYMENT_AMOUNT',
    details: {
      minimumUsd: 25,
      payCurrency: 'btc',
    },
  }), {
    code: 'BELOW_MINIMUM_PAYMENT_AMOUNT',
    message: 'Le montant minimum pour BTC est d’environ 25.00 USD.',
    status: 422,
  });
});

test('crypto checkout configuration failures are safe for public display', () => {
  assert.deepEqual(getPublicCryptoCheckoutError(new Error('NOWPAYMENTS_API_KEY est manquante.')), {
    code: 'CRYPTO_NOT_CONFIGURED',
    message: 'Le paiement crypto est temporairement indisponible. La configuration du service doit être terminée.',
    status: 503,
  });
});

test('provider currency failures tell the customer to choose another network', () => {
  assert.deepEqual(getPublicCryptoCheckoutError({
    type: 'api',
    code: 'API_REQUEST_FAILED',
    httpStatus: 400,
    details: { message: 'The selected currency is not available' },
  }), {
    code: 'CRYPTO_CURRENCY_UNAVAILABLE',
    message: 'Cette crypto ou ce réseau est temporairement indisponible chez NOWPayments. Choisissez une autre option.',
    status: 422,
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

test('crypto payment safety minimums cover provider network costs', () => {
  assert.equal(getCryptoPaymentOperationalMinimumUsd('trx'), 10);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('usdttrc20'), 20);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('ton'), 20);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('bnbbsc'), 20);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('btc'), 25);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('eth'), 50);
  assert.equal(getCryptoPaymentOperationalMinimumUsd('usdterc20'), 50);
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
