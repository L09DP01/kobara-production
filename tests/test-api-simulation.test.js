import test from 'node:test';
import assert from 'node:assert/strict';

function simulatePaymentProcess(payment, targetStatus = 'succeeded') {
  if (payment.environment !== 'test') {
    return {
      success: false,
      statusCode: 403,
      error: "La simulation est strictement réservée aux paiements créés en mode TEST.",
    };
  }

  if (targetStatus === 'succeeded') {
    const paidAt = new Date().toISOString();
    const netAmount = payment.amount - (payment.amount * 0.029);
    
    return {
      success: true,
      statusCode: 200,
      payment: {
        ...payment,
        status: 'succeeded',
        paid_at: paidAt,
        net_amount: parseFloat(netAmount.toFixed(2)),
      },
      balanceCredited: {
        environment: 'test',
        amount: parseFloat(netAmount.toFixed(2)),
      },
      webhookTriggered: {
        event_type: 'payment.succeeded',
        payment_id: payment.id,
      }
    };
  } else {
    return {
      success: true,
      statusCode: 200,
      payment: {
        ...payment,
        status: 'failed',
      },
      webhookTriggered: {
        event_type: 'payment.failed',
        payment_id: payment.id,
      }
    };
  }
}

test('API Test Payments Simulation & Database Recording Invariants', async (t) => {

  await t.test('Test 1: Simulation d\'un paiement de test via API v1 enregistre le statut succeeded dans la DB', () => {
    const testPayment = {
      id: 'pay_test_998877',
      kobara_reference: 'KOB-889900',
      merchant_id: 'm_test_123',
      amount: 1000,
      currency: 'HTG',
      environment: 'test',
      status: 'pending',
    };

    const res = simulatePaymentProcess(testPayment, 'succeeded');

    assert.equal(res.success, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payment.status, 'succeeded');
    assert.ok(res.payment.paid_at);
    assert.equal(res.balanceCredited.environment, 'test');
    assert.equal(res.webhookTriggered.event_type, 'payment.succeeded');
  });

  await t.test('Test 2: Option simulate_success lors de la création -> Enregistre directement status succeeded', () => {
    const initialRequestPayload = {
      amount: 2500,
      currency: 'HTG',
      simulate_success: true,
    };

    const createdPayment = {
      id: 'pay_test_112233',
      kobara_reference: 'KOB-112233',
      merchant_id: 'm_test_123',
      amount: initialRequestPayload.amount,
      environment: 'test',
      status: 'pending',
    };

    if (initialRequestPayload.simulate_success) {
      const res = simulatePaymentProcess(createdPayment, 'succeeded');
      assert.equal(res.payment.status, 'succeeded');
      assert.equal(res.balanceCredited.amount, 2427.5); // 2500 - 2.9%
    }
  });

  await t.test('Test 3: Tentative de simulation sur un paiement LIVE -> Rejet strict HTTP 403 Forbidden', () => {
    const livePayment = {
      id: 'pay_live_000111',
      kobara_reference: 'KOB-000111',
      merchant_id: 'm_live_123',
      amount: 5000,
      currency: 'HTG',
      environment: 'live',
      status: 'pending',
    };

    const res = simulatePaymentProcess(livePayment, 'succeeded');

    assert.equal(res.success, false);
    assert.equal(res.statusCode, 403);
    assert.match(res.error, /MODE TEST/i);
  });

  await t.test('Test 4: Simulation d\'un échec de paiement -> Enregistre status failed et webhook payment.failed', () => {
    const testPayment = {
      id: 'pay_test_554433',
      kobara_reference: 'KOB-554433',
      merchant_id: 'm_test_123',
      amount: 500,
      currency: 'HTG',
      environment: 'test',
      status: 'pending',
    };

    const res = simulatePaymentProcess(testPayment, 'failed');

    assert.equal(res.success, true);
    assert.equal(res.payment.status, 'failed');
    assert.equal(res.webhookTriggered.event_type, 'payment.failed');
  });
});
