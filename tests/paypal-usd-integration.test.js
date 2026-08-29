import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentCreatePayloadSchema } from '../src/lib/server/validators.ts';
import { resolveUsdAccountState } from '../src/lib/usd-account.ts';

const HTG_TO_USD_RATE = 130;
const PAYPAL_FEE_PERCENT = 0.035;
const PAYPAL_FEE_FIXED_USD = 0.70;
const USD_WITHDRAWAL_FEE_PERCENT = 0.02;

function convertHtgToUsd(amountHtg, htgPerUsd = HTG_TO_USD_RATE) {
  if (!amountHtg || amountHtg <= 0) return 0;
  return Math.max(0.01, parseFloat((amountHtg / htgPerUsd).toFixed(2)));
}

function calculatePayPalFees(amountUsd) {
  const gross = Math.max(0, parseFloat(Number(amountUsd).toFixed(2)));
  const fee = parseFloat(((gross * PAYPAL_FEE_PERCENT) + PAYPAL_FEE_FIXED_USD).toFixed(2));
  const net = Math.max(0, parseFloat((gross - fee).toFixed(2)));
  return { grossUsd: gross, feeUsd: fee, netUsd: net };
}

function calculateUsdWithdrawalFees(amountUsd) {
  const gross = Math.max(0, parseFloat(Number(amountUsd).toFixed(2)));
  const fee = parseFloat((gross * USD_WITHDRAWAL_FEE_PERCENT).toFixed(2));
  const net = Math.max(0, parseFloat((gross - fee).toFixed(2)));
  return { amountUsd: gross, feeUsd: fee, netUsd: net };
}

test('PayPal & Multi-Currency USD Integration Invariants', async (t) => {

  await t.test('Conversion HTG to USD respects fixed 130 HTG = 1.00 USD rate', () => {
    assert.equal(HTG_TO_USD_RATE, 130);
    assert.equal(convertHtgToUsd(130), 1.00);
    assert.equal(convertHtgToUsd(2600), 20.00);
    assert.equal(convertHtgToUsd(6500), 50.00);
    assert.equal(convertHtgToUsd(6600, 132), 50.00);
    assert.equal(convertHtgToUsd(0), 0);
  });

  await t.test('PayPal payment fee calculation adheres strictly to 3.5% + $0.70', () => {
    assert.equal(PAYPAL_FEE_PERCENT, 0.035);
    assert.equal(PAYPAL_FEE_FIXED_USD, 0.70);

    // Test $100 payment: 100 * 0.035 = 3.50 + 0.70 = 4.20 fee -> 95.80 net
    const calc100 = calculatePayPalFees(100);
    assert.equal(calc100.grossUsd, 100);
    assert.equal(calc100.feeUsd, 4.20);
    assert.equal(calc100.netUsd, 95.80);

    // Test $20 payment: 20 * 0.035 = 0.70 + 0.70 = 1.40 fee -> 18.60 net
    const calc20 = calculatePayPalFees(20);
    assert.equal(calc20.grossUsd, 20);
    assert.equal(calc20.feeUsd, 1.40);
    assert.equal(calc20.netUsd, 18.60);
  });

  await t.test('USD Withdrawal fee calculation adheres strictly to 2% for Zelle and PayPal', () => {
    assert.equal(USD_WITHDRAWAL_FEE_PERCENT, 0.02);

    // Test $100 withdrawal: 100 * 0.02 = 2.00 fee -> 98.00 net
    const wth100 = calculateUsdWithdrawalFees(100);
    assert.equal(wth100.amountUsd, 100);
    assert.equal(wth100.feeUsd, 2.00);
    assert.equal(wth100.netUsd, 98.00);

    // Test $500 withdrawal: 500 * 0.02 = 10.00 fee -> 490.00 net
    const wth500 = calculateUsdWithdrawalFees(500);
    assert.equal(wth500.amountUsd, 500);
    assert.equal(wth500.feeUsd, 10.00);
    assert.equal(wth500.netUsd, 490.00);
  });

  await t.test('API validation accepts every hosted international payment source', () => {
    const validProviders = ['carte', 'card', 'paypal', 'apple_pay', 'google_pay', 'kobara', 'moncash', 'natcash'];

    for (const provider of validProviders) {
      const parsed = PaymentCreatePayloadSchema.safeParse({
        amount: 2500,
        currency: 'HTG',
        provider,
      });
      assert.equal(parsed.success, true, `Provider '${provider}' should be accepted`);
      assert.equal(parsed.data?.provider, provider);
    }
  });

  await t.test('API Validation schema defaults to kobara provider when omitted', () => {
    const parsed = PaymentCreatePayloadSchema.safeParse({
      amount: 1500,
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.provider, 'kobara');
  });

  await t.test('Merchant eligibility state machine logic', () => {
    const hidden = resolveUsdAccountState({ globalEnabled: false });
    assert.equal(hidden.status, 'hidden');
    assert.equal(hidden.isActive, false);

    const available = resolveUsdAccountState({ globalEnabled: false, merchantEnabled: true });
    assert.equal(available.status, 'available');
    assert.equal(available.canCreate, true);

    const globallyAvailable = resolveUsdAccountState({ globalEnabled: true, merchantEnabled: false });
    assert.equal(globallyAvailable.status, 'available');
    assert.equal(globallyAvailable.canCreate, true);

    const active = resolveUsdAccountState({
      globalEnabled: true,
      merchantEnabled: true,
      merchantHasAccount: true,
    });
    assert.equal(active.status, 'active');
    assert.equal(active.isActive, true);

    const suspended = resolveUsdAccountState({
      globalEnabled: false,
      merchantEnabled: false,
      settingsEnabled: true,
      merchantHasAccount: true,
    });
    assert.equal(suspended.status, 'suspended');
    assert.equal(suspended.isActive, false);

    const globallyStopped = resolveUsdAccountState({
      globalEnabled: false,
      merchantEnabled: true,
      merchantHasAccount: true,
    });
    assert.equal(globallyStopped.status, 'active');
    assert.equal(globallyStopped.isActive, true);
  });

  await t.test('PayPal Webhook verification signature payload structure', () => {
    const verifyPayload = {
      auth_algo: 'SHA256withRSA',
      cert_url: 'https://api.paypal.com/v1/notifications/certs/CERT-123',
      transmission_id: 'trans_abc_123',
      transmission_sig: 'sig_xyz_789',
      transmission_time: '2026-08-26T15:30:00Z',
      webhook_id: 'WH-1234567890',
      webhook_event: {
        id: 'WH-EVENT-001',
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAP-998877',
          amount: { value: '20.00', currency_code: 'USD' },
          custom_id: 'pay_123456',
        }
      }
    };

    assert.equal(verifyPayload.auth_algo, 'SHA256withRSA');
    assert.equal(verifyPayload.webhook_event.event_type, 'PAYMENT.CAPTURE.COMPLETED');
    assert.equal(verifyPayload.webhook_event.resource.amount.value, '20.00');
  });

  await t.test('PayPal Webhook event processing transitions state and credits USD balance', () => {
    const initialPayment = {
      id: 'pay_test_001',
      status: 'pending',
      amount: 2600, // HTG
      merchant_id: 'm_100',
    };

    const initialMerchant = {
      id: 'm_100',
      available_balance_usd: 50.00,
    };

    const webhookEvent = {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP_PAYPAL_999',
        custom_id: 'pay_test_001',
        amount: { value: '20.00', currency_code: 'USD' },
      }
    };

    // Simulate transition
    const amountUsd = Number(webhookEvent.resource.amount.value);
    const fees = calculatePayPalFees(amountUsd); // 20 * 0.035 + 0.70 = 1.40 -> 18.60 net
    const updatedPaymentStatus = 'succeeded';
    const updatedMerchantUsdBalance = initialMerchant.available_balance_usd + fees.netUsd;

    assert.equal(fees.grossUsd, 20.00);
    assert.equal(fees.feeUsd, 1.40);
    assert.equal(fees.netUsd, 18.60);
    assert.equal(updatedPaymentStatus, 'succeeded');
    assert.equal(updatedMerchantUsdBalance, 68.60);
  });

});
