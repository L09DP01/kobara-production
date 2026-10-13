import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getWithdrawalFailureDetails } from '../src/lib/withdrawal-failure-details.ts';
import { redactSecrets } from '../src/lib/sensitive-text.ts';

test('failed withdrawal details preserve a safe provider code and confirmed refund', () => {
  const details = getWithdrawalFailureDetails({
    failed_reason: 'Invalid receiver', provider_response: { code: 'INVALID_RECEIVER', status: 400 },
    refunded_at: '2026-10-13T12:00:00Z',
  });
  assert.equal(details.httpStatus, 400);
  assert.equal(details.providerCode, 'INVALID_RECEIVER');
  assert.match(details.reason, /destinataire/);
  assert.equal(details.refundedAt, '2026-10-13T12:00:00Z');
});

test('provider HTML, repeated secrets and raw responses are never displayed', () => {
  const dummy = ['kbr', 'sk', 'live', 'EXAMPLE_NOT_A_REAL_KEY'].join('_');
  assert.equal(redactSecrets(`${dummy} ${dummy}`).includes(dummy), false);
  const details = getWithdrawalFailureDetails({ failed_reason: `HTTP 403 <html>${dummy}</html>`, provider_response: { authorization: dummy, message: dummy } });
  assert.equal(details.httpStatus, 403);
  assert.equal(JSON.stringify(details).includes(dummy), false);
  assert.equal(JSON.stringify(details).includes('<html>'), false);
  assert.equal('authorization' in details, false);
});

test('missing diagnostics and missing refund evidence do not invent a cause or refund', () => {
  const details = getWithdrawalFailureDetails({});
  assert.match(details.reason, /Aucun motif/);
  assert.equal(details.refundedAt, null);
  assert.equal(details.httpStatus, null);
  assert.equal(details.providerCode, null);
});

test('admin page strips the raw provider payload before passing client props', () => {
  const page = readFileSync(new URL('../src/app/system-core/(protected)/withdrawals/page.tsx', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../src/app/system-core/(protected)/withdrawals/withdrawals-admin-client.tsx', import.meta.url), 'utf8');
  assert.match(page, /provider_response, failed_reason, \.\.\.withdrawal/);
  assert.match(page, /failure_details: withdrawal\.status === 'failed' \? details : null/);
  assert.match(page, /requireAdmin/);
  assert.match(client, /w\.status === 'failed' && w\.failure_details/);
  assert.match(client, /WithdrawalFailureInfo/);
});
