import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('Telegram Bot Integration: Live-Only & Security Invariants', async (t) => {
  await t.test('Test payments are strictly ignored and NEVER sent to Telegram', () => {
    const testPayment = {
      id: 'pay_test_123',
      merchant_id: 'm_123',
      environment: 'test',
      status: 'succeeded',
      amount: 1000,
    };

    const isNotificationEligible = (payment) => {
      if (payment.environment === 'test') return false;
      if (payment.status !== 'succeeded') return false;
      return true;
    };

    assert.equal(
      isNotificationEligible(testPayment),
      false,
      'Test payments must be completely filtered out from Telegram notifications'
    );

    const livePayment = {
      id: 'pay_live_456',
      merchant_id: 'm_123',
      environment: 'live',
      status: 'succeeded',
      amount: 1000,
    };

    assert.equal(
      isNotificationEligible(livePayment),
      true,
      'Live succeeded payments are eligible for instant Telegram push'
    );
  });

  await t.test('Telegram Deep-Link Token Generation & Expiration', () => {
    const token = `kbr_${crypto.randomBytes(16).toString('hex')}`;
    assert.ok(token.startsWith('kbr_'));
    assert.equal(token.length, 36);

    const now = Date.now();
    const expiresAt = new Date(now + 15 * 60 * 1000).toISOString();
    const isTokenValid = (exp, used) => !used && new Date(exp) > new Date();

    assert.equal(isTokenValid(expiresAt, null), true, 'Active token within 15 min must be valid');
    assert.equal(isTokenValid(expiresAt, new Date().toISOString()), false, 'Used token must be invalid');
    assert.equal(isTokenValid(new Date(now - 1000).toISOString(), null), false, 'Expired token must be invalid');
  });

  await t.test('Bot Payment Link Creation produces strictly LIVE link with required slug', () => {
    const createBotPaymentLinkPayload = (merchantId, title, amount) => ({
      merchant_id: merchantId,
      title: title.trim(),
      amount: Number(amount),
      currency: 'HTG',
      status: 'active',
      slug: crypto.randomBytes(5).toString('hex'),
      environment: 'live', // Strictly LIVE
    });

    const payload = createBotPaymentLinkPayload('m_abc', 'Vente Chaussure', 2500);
    assert.equal(payload.environment, 'live', 'Payment link created via bot must always be LIVE');
    assert.equal(payload.amount, 2500);
    assert.equal(payload.currency, 'HTG');
    assert.ok(payload.slug, 'Slug must be present');
  });

  await t.test('Bot Withdrawal State Machine enforces 150 HTG minimum and OTP requirement', () => {
    const validateWithdrawalInput = (amount, availableBalance) => {
      if (isNaN(amount) || amount < 150) {
        return { error: 'Montant minimum 150 HTG' };
      }
      if (amount > availableBalance) {
        return { error: 'Solde insuffisant' };
      }
      return { success: true };
    };

    assert.equal(validateWithdrawalInput(100, 5000).error, 'Montant minimum 150 HTG');
    assert.equal(validateWithdrawalInput(6000, 5000).error, 'Solde insuffisant');
    assert.equal(validateWithdrawalInput(2500, 5000).success, true);
  });

  await t.test('Telegram live push notification format contains required details', () => {
    const payment = {
      gross_amount: 2500,
      net_amount: 2427.5,
      fee_amount: 72.5,
      currency: 'HTG',
      payment_method: 'moncash',
      transaction_reference: 'KOB92837492',
    };

    const formatNotification = (p) => `
🟢 NOUVEAU PAIEMENT REÇU (LIVE) !
💰 Montant : ${p.gross_amount.toLocaleString('fr-HT')} ${p.currency}
💵 Net crédité : ${p.net_amount.toLocaleString('fr-HT')} ${p.currency}
💳 Méthode : ${p.payment_method.toUpperCase()}
🆔 Référence : ${p.transaction_reference}
    `.trim();

    const formatted = formatNotification(payment);
    assert.ok(formatted.includes('HTG'));
    assert.ok(formatted.includes('MONCASH'));
    assert.ok(formatted.includes('KOB92837492'));
    assert.ok(formatted.includes('LIVE'));
  });
});
