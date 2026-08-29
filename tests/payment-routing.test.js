import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPaymReference,
  getRecordedPaymentProcessor,
  isValidPaymReference,
  normalizeHaitianPhoneNumber,
  normalizePaymAmount,
  normalizePaymentRoutingConfig,
  resolveApiCheckoutUrl,
  resolvePaymentRoute,
} from '../src/lib/payment-routing.ts';
import { PaymentCreatePayloadSchema, PaymentResponseSchema } from '../src/lib/server/validators.ts';
import {
  getPublicApiCorsHeaders,
  MOBILE_API_CORS_HEADERS,
  MOBILE_APP_ORIGIN,
} from '../src/lib/http/api-cors.ts';

const paym = {
  active_provider: 'paym',
  sms_gateway_enabled: true,
  paym_moncash_web: true,
  paym_moncash_ussd: true,
  paym_natcash_web: true,
  paym_natcash_ussd: true,
};

const bazik = {
  ...paym,
  active_provider: 'bazik',
  sms_gateway_enabled: true,
};

test('API payment providers are case-insensitive', () => {
  const basePayload = { amount: 1000, currency: 'HTG' };

  assert.equal(PaymentCreatePayloadSchema.parse({ ...basePayload, provider: 'Natcash' }).provider, 'natcash');
  assert.equal(PaymentCreatePayloadSchema.parse({ ...basePayload, provider: 'NATCASH' }).provider, 'natcash');
  assert.equal(PaymentCreatePayloadSchema.parse({ ...basePayload, provider: 'MonCash' }).provider, 'moncash');
  assert.equal(PaymentCreatePayloadSchema.parse({ ...basePayload, provider: 'KOBARA' }).provider, 'kobara');
});

test('API payment responses expose current and legacy checkout URL fields', () => {
  const checkoutUrl = 'https://pay.kobara.app/checkout/payment-id';
  const response = PaymentResponseSchema.parse({
    status: 'success',
    data: {
      id: 'payment-id',
      reference: 'KOB123456789',
      amount: 1000,
      status: 'pending',
      checkout_url: checkoutUrl,
      url: checkoutUrl,
    },
  });

  assert.equal(response.data.checkout_url, checkoutUrl);
  assert.equal(response.data.url, checkoutUrl);
});

test('API CORS permits any origin for public API without credentials', () => {
  const publicHeaders = getPublicApiCorsHeaders('https://untrusted.example');
  assert.ok(publicHeaders);
  assert.match(publicHeaders['Access-Control-Allow-Headers'], /Idempotency-Key/);
  assert.equal(publicHeaders['Access-Control-Allow-Origin'], 'https://untrusted.example');
  assert.equal('Access-Control-Allow-Credentials' in publicHeaders, false);
  assert.equal(MOBILE_API_CORS_HEADERS['Access-Control-Allow-Credentials'], 'true');
});

test("Pay'm routes MonCash Web to Pay'm", () => {
  const route = resolvePaymentRoute(paym, { wallet: 'moncash' });
  assert.equal(route.processor, 'paym');
  assert.equal(route.providerMethod, 'moncash');
});

test("Pay'm routes MonCash USSD only with a phone", () => {
  const route = resolvePaymentRoute(paym, {
    wallet: 'moncash',
    requestedMethod: 'ussd',
    phoneNumber: '50937000000',
  });
  assert.equal(route.providerMethod, 'moncash_ussd');
  assert.throws(
    () => resolvePaymentRoute(paym, { wallet: 'moncash', requestedMethod: 'ussd' }),
    { code: 'PHONE_REQUIRED' }
  );
});

test("Pay'm routes NatCash Web to Pay'm, never to SMS", () => {
  const route = resolvePaymentRoute(paym, { wallet: 'natcash' });
  assert.equal(route.processor, 'paym');
  assert.equal(route.providerMethod, 'natcash');
  assert.equal(route.requiresSmsConfirmation, false);
});

test('Paym input normalization accepts Haitian phones and safe references', () => {
  assert.equal(normalizeHaitianPhoneNumber('4158-6811'), '50941586811');
  assert.equal(normalizeHaitianPhoneNumber('509 4158 6811'), '50941586811');
  assert.equal(normalizeHaitianPhoneNumber('123'), null);
  assert.equal(isValidPaymReference('CMD20250001'), true);
  assert.equal(isValidPaymReference('CMD-20250001'), false);
  assert.equal(isValidPaymReference('TX_123_456'), false);
  assert.equal(isValidPaymReference('KOB-1786816177430-123456'), false);
  const generatedReference = createPaymReference('KOB');
  assert.equal(isValidPaymReference(generatedReference), true);
  assert.match(generatedReference, /^KOB[A-Z0-9]+$/);
  assert.ok(generatedReference.length <= 20);
});

test('Paym sends whole HTG amounts to NatCash without changing MonCash amounts', () => {
  assert.equal(normalizePaymAmount('natcash', 1441.81), 1442);
  assert.equal(normalizePaymAmount('natcash', 1400), 1400);
  assert.equal(normalizePaymAmount('moncash', 1441.81), 1441.81);
});

test("Pay'm rejects undocumented NatCash USSD", () => {
  assert.throws(
    () => resolvePaymentRoute(paym, { wallet: 'natcash', requestedMethod: 'ussd' }),
    { code: 'PAYM_NATCASH_USSD_UNSUPPORTED' }
  );
});

test('Bazik routes MonCash to Bazik', () => {
  const route = resolvePaymentRoute(bazik, { wallet: 'moncash' });
  assert.equal(route.processor, 'bazik');
});

test('Bazik routes NatCash to SMS Gateway', () => {
  const route = resolvePaymentRoute(bazik, { wallet: 'natcash' });
  assert.equal(route.processor, 'sms_gateway');
  assert.equal(route.requiresSmsConfirmation, true);
});

test('Bazik rejects NatCash when SMS Gateway is disabled', () => {
  assert.throws(
    () => resolvePaymentRoute({ ...bazik, sms_gateway_enabled: false }, { wallet: 'natcash' }),
    { code: 'SMS_GATEWAY_DISABLED' }
  );
});

test('configuration normalization cannot enable SMS or NatCash USSD under Paym', () => {
  const normalized = normalizePaymentRoutingConfig(paym);
  assert.equal(normalized.sms_gateway_enabled, false);
  assert.equal(normalized.paym_natcash_ussd, false);
});

test('recorded processor survives a later global switch', () => {
  assert.equal(
    getRecordedPaymentProcessor({
      provider: 'natcash',
      payment_method: 'natcash',
      reference_code: 'KBR1AB23',
      metadata: { payment_processor: 'paym' },
    }),
    'paym'
  );
});

test('API returns the direct NatCash URL from the active gateway', () => {
  const url = resolveApiCheckoutUrl({
    requestedProvider: 'natcash',
    environment: 'live',
    paymentId: 'pay_natcash',
    checkoutBaseUrl: 'https://pay.kobara.app',
    processor: 'paym',
    externalUrl: 'https://merchantpay.natcom.com.ht/?token=test',
  });
  assert.equal(url, 'https://merchantpay.natcom.com.ht/?token=test');
});

test('API returns the direct MonCash URL without changing legacy routing', () => {
  const url = resolveApiCheckoutUrl({
    requestedProvider: 'moncash',
    environment: 'live',
    paymentId: 'pay_moncash',
    checkoutBaseUrl: 'https://pay.kobara.app',
    processor: 'bazik',
    externalUrl: 'https://moncash.example/checkout',
  });
  assert.equal(url, 'https://moncash.example/checkout');
});

test('API keeps Kobara and SMS confirmation on the internal checkout', () => {
  assert.equal(
    resolveApiCheckoutUrl({
      requestedProvider: 'kobara',
      environment: 'live',
      paymentId: 'pay_unified',
      checkoutBaseUrl: 'https://pay.kobara.app/',
    }),
    'https://pay.kobara.app/checkout/pay_unified'
  );
  assert.equal(
    resolveApiCheckoutUrl({
      requestedProvider: 'natcash',
      environment: 'live',
      paymentId: 'pay_sms',
      checkoutBaseUrl: 'https://pay.kobara.app',
      processor: 'sms_gateway',
    }),
    'https://pay.kobara.app/checkout/pay_sms/natcash'
  );
});

test('API test payments always use the internal checkout', () => {
  assert.equal(
    resolveApiCheckoutUrl({
      requestedProvider: 'moncash',
      environment: 'test',
      paymentId: 'pay_test',
      checkoutBaseUrl: 'http://localhost:3000/pay',
      processor: 'paym',
      externalUrl: 'https://external.example/ignored',
    }),
    'http://localhost:3000/pay/checkout/pay_test'
  );
});
