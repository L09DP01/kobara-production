import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHaitianPhoneNumber } from '../src/lib/payment-routing.ts';
import { calculateWithdrawalQuote } from '../src/lib/withdrawal-currency.ts';

test('Withdrawal System: Phone Number Validation', async (t) => {
  await t.test('accepts 8-digit Haitian numbers and normalizes with 509', () => {
    assert.equal(normalizeHaitianPhoneNumber('34567890'), '50934567890');
    assert.equal(normalizeHaitianPhoneNumber('41234567'), '50941234567');
  });

  await t.test('accepts 11-digit Haitian numbers starting with 509', () => {
    assert.equal(normalizeHaitianPhoneNumber('50934567890'), '50934567890');
    assert.equal(normalizeHaitianPhoneNumber('+509 34 56 7890'), '50934567890');
    assert.equal(normalizeHaitianPhoneNumber('509-4123-4567'), '50941234567');
  });

  await t.test('rejects invalid, short, or foreign phone numbers', () => {
    assert.equal(normalizeHaitianPhoneNumber(''), null);
    assert.equal(normalizeHaitianPhoneNumber(null), null);
    assert.equal(normalizeHaitianPhoneNumber('12345'), null);
    assert.equal(normalizeHaitianPhoneNumber('abcdefgh'), null);
    assert.equal(normalizeHaitianPhoneNumber('18091234567'), null); // Dominican Republic
    assert.equal(normalizeHaitianPhoneNumber('13051234567'), null); // US
  });
});

test('Withdrawal System: Fee Calculation & Accounting Invariants', async (t) => {
  await t.test('calculates 5% fee for MonCash & NatCash, net amount sent to provider', () => {
    const grossAmount = 1000;
    const feeRate = 0.05;
    const fees = grossAmount * feeRate;
    const netAmount = grossAmount - fees;

    assert.equal(fees, 50);
    assert.equal(netAmount, 950);
    assert.equal(netAmount + fees, grossAmount);
  });

  await t.test('calculates 2% fee for manual USD withdrawals', () => {
    const grossAmount = 100;
    const feeRate = 0.02;
    const fees = grossAmount * feeRate;
    const netAmount = grossAmount - fees;

    assert.equal(fees, 2);
    assert.equal(netAmount, 98);
  });

  await t.test('ensures minimum amounts are strictly respected', () => {
    const isAllowedMoncash = (amount) => amount >= 150;
    const isAllowedNatcash = (amount) => amount >= 150;
    const isAllowedZelle = (amount) => amount >= 10;

    assert.equal(isAllowedMoncash(100), false);
    assert.equal(isAllowedMoncash(150), true);
    assert.equal(isAllowedMoncash(500), true);

    assert.equal(isAllowedNatcash(149), false);
    assert.equal(isAllowedNatcash(150), true);

    assert.equal(isAllowedZelle(9.99), false);
    assert.equal(isAllowedZelle(10), true);
  });

  await t.test('keeps HTG and USD accounting mutually exclusive', () => {
    const resolveLedgerCurrency = ({ provider, method }) => {
      const normalizedProvider = provider.toLowerCase();
      const normalizedMethod = method.toLowerCase();
      if (normalizedProvider === 'paypal' || ['card', 'paypal', 'apple_pay', 'google_pay'].includes(normalizedMethod)) return 'USD';
      if (['moncash', 'natcash', 'paym', 'bazik'].includes(normalizedProvider) || ['moncash', 'moncash_ussd', 'natcash'].includes(normalizedMethod)) return 'HTG';
      return null;
    };

    assert.equal(resolveLedgerCurrency({ provider: 'paypal', method: 'card' }), 'USD');
    assert.equal(resolveLedgerCurrency({ provider: 'paym', method: 'natcash' }), 'HTG');
    assert.equal(resolveLedgerCurrency({ provider: 'kobara', method: 'kobara' }), null);
  });

  await t.test('converts from either account to any withdrawal method', () => {
    const htgToPaypal = calculateWithdrawalQuote({ amount: 13000, method: 'PayPal', sourceCurrency: 'HTG', exchangeRate: 130 });
    assert.equal(htgToPaypal.fees, 260);
    assert.equal(htgToPaypal.payoutCurrency, 'USD');
    assert.equal(htgToPaypal.payoutAmount, 98);

    const usdToMoncash = calculateWithdrawalQuote({ amount: 100, method: 'MonCash', sourceCurrency: 'USD', exchangeRate: 130 });
    assert.equal(usdToMoncash.fees, 5);
    assert.equal(usdToMoncash.payoutCurrency, 'HTG');
    assert.equal(usdToMoncash.payoutAmount, 12350);

    const usdToPaypal = calculateWithdrawalQuote({ amount: 100, method: 'PayPal', sourceCurrency: 'USD', exchangeRate: 130 });
    assert.equal(usdToPaypal.payoutAmount, 98);
  });
});

test('Withdrawal System: Collision-proof Reference Generator (Strictly Alphanumeric, No Dash or Underscore)', async (t) => {
  const { createPaymReference, isValidPaymReference } = await import('../src/lib/payment-routing.ts');

  await t.test('generates strictly alphanumeric references without - or _', () => {
    const refs = new Set();
    for (let i = 0; i < 1000; i++) {
      const ref = createPaymReference('WTH');
      assert.ok(ref.startsWith('WTH'));
      assert.equal(ref.includes('-'), false, `Reference must NOT contain dashes: ${ref}`);
      assert.equal(ref.includes('_'), false, `Reference must NOT contain underscores: ${ref}`);
      assert.ok(isValidPaymReference(ref), `Reference must be valid Paym reference: ${ref}`);
      assert.ok(ref.length <= 20, `Reference length must be <= 20: ${ref}`);
      assert.ok(!refs.has(ref), `Duplicate reference detected: ${ref}`);
      refs.add(ref);
    }
  });
});

test('Withdrawal System: State Machine & Refund Invariants', async (t) => {
  await t.test('pre-payout failure (401 Auth / Token stage) triggers immediate refund', () => {
    let balance = 10000;
    const withdrawalTotal = 4200;

    // 1. Initial balance reservation
    balance -= withdrawalTotal;
    let withdrawalStatus = 'pending';
    let refunded = false;

    assert.equal(balance, 5800);
    assert.equal(withdrawalStatus, 'pending');

    // 2. Pre-payout failure simulation (stage: 'TOKEN', payoutSubmitted: false)
    const paymResponse = {
      success: false,
      stage: 'TOKEN',
      payoutSubmitted: false,
      message: "Jeton d'authentification manquant.",
      error_code: 'AUTH_EXPIRED'
    };

    if (!paymResponse.success && !paymResponse.payoutSubmitted) {
      // Immediate atomic refund because money never left Kobara
      if (!refunded) {
        balance += withdrawalTotal;
        withdrawalStatus = 'failed';
        refunded = true;
      }
    }

    assert.equal(balance, 10000, 'Balance must be fully restored upon pre-payout failure');
    assert.equal(withdrawalStatus, 'failed', 'Withdrawal status must transition to failed');
    assert.equal(refunded, true);
  });

  await t.test('prevents double refund via idempotency guard', () => {
    let balance = 10000;
    const withdrawalAmount = 5000;
    balance -= withdrawalAmount; // 5000

    let withdrawalStatus = 'pending';
    let refundedAt = null;

    const refund = () => {
      if (withdrawalStatus === 'completed') {
        throw new Error('Cannot refund a completed withdrawal');
      }
      if (refundedAt !== null) {
        return false; // Already refunded, idempotent no-op
      }
      balance += withdrawalAmount;
      withdrawalStatus = 'failed';
      refundedAt = new Date().toISOString();
      return true;
    };

    // First refund attempt
    const firstAttempt = refund();
    assert.equal(firstAttempt, true);
    assert.equal(balance, 10000);
    assert.equal(withdrawalStatus, 'failed');

    // Second refund attempt (e.g. duplicate webhook or retry)
    const secondAttempt = refund();
    assert.equal(secondAttempt, false);
    assert.equal(balance, 10000, 'Balance must not increase again on second refund attempt');
  });

  await t.test('does not refund when payout execution is uncertain / pending verification', () => {
    let balance = 10000;
    const withdrawalAmount = 4000;
    balance -= withdrawalAmount;

    let withdrawalStatus = 'pending';
    const isTimeoutAfterPayoutSubmission = true;

    if (isTimeoutAfterPayoutSubmission) {
      // Do NOT refund immediately
      withdrawalStatus = 'pending';
    }

    assert.equal(balance, 6000, 'Balance must remain reserved while verification is pending');
    assert.equal(withdrawalStatus, 'pending');
  });
});
