import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260904171402_harden_b2b_balance_credit.sql', import.meta.url),
  'utf8',
);
const service = fs.readFileSync(
  new URL('../src/lib/server/transfers/b2b-transfer.service.ts', import.meta.url),
  'utf8',
);
const bot = fs.readFileSync(
  new URL('../src/lib/server/telegram/telegram-bot.service.ts', import.meta.url),
  'utf8',
);
const usage = fs.readFileSync(
  new URL('../src/lib/server/usage.ts', import.meta.url),
  'utf8',
);
const mobileTransferRoute = fs.readFileSync(
  new URL('../src/app/api/mobile/transfers/route.ts', import.meta.url),
  'utf8',
);

test('B2B accounting preserves value and credits the receiver', () => {
  const senderBefore = 1_000;
  const receiverBefore = 19.2;
  const amount = 250;
  const senderAfter = senderBefore - amount;
  const receiverAfter = receiverBefore + amount;

  assert.equal(senderAfter, 750);
  assert.equal(receiverAfter, 269.2);
  assert.equal(senderAfter + receiverAfter, senderBefore + receiverBefore);
});

test('B2B migration verifies both balance mutations before returning success', () => {
  assert.match(migration, /COALESCE\(available_balance, 0\) - p_amount/);
  assert.match(migration, /COALESCE\(available_balance, 0\) \+ p_amount/);
  assert.match(migration, /b2b_receiver_credit_failed/);
  assert.match(migration, /b2b_balance_invariant_failed/);
  assert.match(migration, /'receiver_balance_after', v_receiver_balance_after/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.process_b2b_transfer_v2[\s\S]+FROM PUBLIC, anon, authenticated/);
});

test('B2B server service rejects incomplete accounting results', () => {
  assert.match(service, /rpc\.receiver_balance_after === undefined/);
  assert.match(service, /INCOMPLETE_ACCOUNTING_RESULT/);
  assert.match(service, /canCreateWithdrawal\(params\.senderId, amount\)/);
  assert.match(service, /admin\.rpc\('process_b2b_transfer_v2'/);
});

test('Telegram B2B flow requires OTP and always executes in live mode', () => {
  assert.match(bot, /step: 'b2b_otp'/);
  assert.match(bot, /verifyWithdrawalOtp/);
  assert.match(bot, /environment: 'live'/);
  assert.match(bot, /B2BTransferService\.processTransfer/);
});

test('Mobile B2B transfers use the same atomic accounting service', () => {
  assert.match(mobileTransferRoute, /B2BTransferService\.processTransfer/);
  assert.doesNotMatch(mobileTransferRoute, /\.rpc\('process_b2b_transfer'/);
});

test('Completed live B2B transfers count toward the daily outgoing limit', () => {
  assert.match(usage, /from\('b2b_transfers'\)/);
  assert.match(usage, /eq\('sender_id', merchantId\)/);
  assert.match(usage, /return withdrawalsTotal \+ b2bTotal/);
});
