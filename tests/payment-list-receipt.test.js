import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { getPaymentListStatus } from '../src/lib/payment-list-filter.ts';

test('payment list defaults to success, search opens all, explicit filters win', () => {
  assert.equal(getPaymentListStatus(), 'succeeded');
  assert.equal(getPaymentListStatus(null, '   '), 'succeeded');
  assert.equal(getPaymentListStatus(null, 'customer'), 'all');
  assert.equal(getPaymentListStatus('all'), 'all');
  assert.equal(getPaymentListStatus('failed', 'customer'), 'failed');
  assert.equal(getPaymentListStatus('invalid'), 'succeeded');
});

function receiptHarness(current = { id: 'unit-payment', merchant_id: 'unit-merchant', status: 'succeeded', environment: 'live', payment_link_id: 'unit-link', metadata: { customer_email: 'payer@example.invalid' } }, link = null) {
  const emails = [];
  let queries = 0;
  const query = {
    update() { return this; }, eq() { return this; }, is() { return this; }, select() { return this; },
    maybeSingle: async () => ({ data: current, error: null }),
    then(resolve) { return Promise.resolve({ error: null }).then(resolve); },
  };
  const mocks = {
    'server-only': {},
    '@/utils/supabase/admin': { createAdminClient: () => ({ from(table) { queries++; return table === 'payment_links' ? { ...query, maybeSingle: async () => ({ data: link, error: null }) } : query; } }) },
    '@/lib/server/mail': { sendEmail: async email => { emails.push(email); return { success: true }; } },
    '@/lib/payment-settlement': { getSettlementAmounts: () => ({ gross: 100, currency: 'HTG' }), getPaymentMethodLabel: () => 'MonCash' },
    '@/lib/payment-notification-policy': { getPayerReceiptEmail: metadata => metadata.customer_email },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/server/payments/customer-receipt.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (!(id in mocks)) throw new Error(`Unexpected import ${id}`);
    return mocks[id];
  }, module, module.exports);
  return { send: module.exports.sendCustomerPaymentReceipt, emails, queries: () => queries };
}

const payment = { id: 'unit-payment', status: 'succeeded', environment: 'live', metadata: { customer_email: 'payer@example.invalid' } };

test('API payments, pending payments, test payments and already-sent receipts send no customer email', async () => {
  const h = receiptHarness();
  await h.send(payment, 'Boutique Demo');
  assert.equal(h.queries(), 0);
  await h.send({ ...payment, payment_link_id: 'unit-link', status: 'pending' }, 'Boutique Demo');
  await h.send({ ...payment, payment_link_id: 'unit-link', environment: 'test' }, 'Boutique Demo');
  await h.send({ ...payment, payment_link_id: 'unit-link', metadata: { ...payment.metadata, customer_receipt_sent_at: '2026-01-01' } }, 'Boutique Demo');
  assert.equal(h.emails.length, 0);
});

test('successful live link sends payer receipt with store sender and escaped store content', async () => {
  const h = receiptHarness();
  await h.send({ ...payment, payment_link_id: 'unit-link' }, 'Boutique <Demo>');
  assert.equal(h.emails.length, 1);
  assert.equal(h.emails[0].to, 'payer@example.invalid');
  assert.equal(h.emails[0].senderName, 'Boutique <Demo>');
  assert.match(h.emails[0].subject, /Boutique <Demo>/);
  assert.match(h.emails[0].html, /Boutique &lt;Demo&gt;/);
  assert.equal(h.emails[0].idempotencyKey, 'customer-receipt-unit-payment');
  assert.equal(h.emails[0].presentation.type, 'transaction');
  assert.equal(h.emails[0].presentation.status, 'succeeded');
  assert.equal(h.emails[0].presentation.merchantName, 'Boutique <Demo>');
});

test('receipt uses fresh metadata and never resends an already delivered receipt', async () => {
  const h = receiptHarness({ ...payment, merchant_id: 'unit-merchant', payment_link_id: 'unit-link', metadata: { customer_email: 'payer@example.invalid', customer_receipt_sent_at: '2026-01-01' } });
  await h.send({ ...payment, payment_link_id: 'unit-link' }, 'Boutique Demo');
  assert.equal(h.emails.length, 0);
});

test('receipt uses product on the linked payment, actual reference, method and paid date', async () => {
  const h = receiptHarness({ ...payment, merchant_id: 'unit-merchant', payment_link_id: 'unit-link', kobara_reference: 'KBR-REAL-1', paid_at: '2026-10-25T14:30:00Z' }, { title: 'Titre secondaire', metadata: { product_name: 'Formation Kobara' }, slug: 'valid-link' });
  await h.send({ ...payment, payment_link_id: 'unit-link' }, 'Boutique Demo');
  const data = h.emails[0].presentation;
  assert.equal(data.reference, 'KBR-REAL-1');
  assert.equal(data.method, 'MonCash');
  assert.equal(data.description, 'Formation Kobara');
  assert.match(data.date, /25 octobre 2026/);
  assert.equal(data.action.url, 'https://pay.kobara.app/valid-link');
  assert.match(h.emails[0].text, /Formation Kobara/);
});

test('customer receipt is attempted even if merchant notification throws', async () => {
  let receipts = 0;
  const row = { ...payment, merchant_id: 'unit-merchant', payment_link_id: 'unit-link', amount: 100, fee_amount: 0, net_amount: 100, currency: 'HTG' };
  const query = { select() { return this; }, eq() { return this; }, single: async () => ({ data: row }), insert: async () => ({}) };
  const mocks = {
    '@/utils/supabase/admin': { createAdminClient: () => ({ from: table => table === 'merchants' ? { ...query, single: async () => ({ data: { business_name: 'Boutique Demo' } }) } : query }) },
    '@/lib/payment-notification-policy': { shouldNotifyMerchantPayment: () => true },
    '@/lib/payment-settlement': { getSettlementAmounts: () => ({ gross: 100, fee: 0, net: 100, currency: 'HTG' }), getPaymentMethodLabel: () => 'MonCash' },
    '@/lib/server/shopify': { reconcileShopifyPayment: async () => {} },
    '@/lib/server/partners/program': { processPartnerPaymentSuccess: async () => {} },
    '@/lib/server/notifications': { notifyPaymentSucceeded: async () => { throw new Error('Notification unavailable'); } },
    './customer-receipt': { sendCustomerPaymentReceipt: async (_payment, name) => { assert.equal(name, 'Boutique Demo'); receipts++; } },
    '@/lib/server/webhooks/dispatcher': { dispatchMerchantWebhook: async () => {} },
    '@/lib/server/telegram/telegram-notifier.service': { TelegramNotifierService: { notifyPaymentReceived: async () => {} } },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL('../src/lib/server/payments/on-payment-succeeded.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => { if (!(id in mocks)) throw Error(`Unexpected import ${id}`); return mocks[id]; }, module, module.exports);
  await module.exports.onPaymentSucceeded(row.id);
  assert.equal(receipts, 1);
});
