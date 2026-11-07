import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
function load(file, mocks) {
  const module = { exports: {} };
  const code = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const input = { to: 'buyer@example.com', subject: 'Actualités', text: 'Exemple', html: '<a href="https://example.com/unsubscribe">Se désabonner</a>', senderName: 'Boutique Exemple', replyTo: 'support@example.com' };
const configuration = { SES_SMTP_HOST: 'email-smtp.us-east-1.amazonaws.com', SES_SMTP_PORT: '465', SES_SMTP_USER: 'unit-test-user', SES_SMTP_PASSWORD: 'unit-test-placeholder', SES_SMTP_FROM: 'Kobara <noreply@example.com>' };
function smtp(sendMail, overrides = {}) {
  const calls = { options: null, message: null, closed: false };
  const env = { ...configuration, ...overrides };
  const module = load('src/lib/server/email/ses-smtp.ts', {
    'server-only': {},
    '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: key => env[key] || '' },
    nodemailer: { default: { createTransport: options => {
      calls.options = options;
      return { sendMail: async message => { calls.message = message; return sendMail(message); }, close: () => { calls.closed = true; } };
    } } },
  });
  return { ...module, calls };
}
test('SES uses authenticated TLS and preserves branded HTML, sender and reply-to', async () => {
  const sender = smtp(async () => ({ accepted: ['buyer@example.com'], messageId: 'mock-id' }));
  assert.equal((await sender.trySesSmtpEmail(input)).status, 'accepted');
  assert.equal(sender.calls.options.secure, true);
  assert.equal(sender.calls.options.requireTLS, true);
  assert.equal(sender.calls.options.tls.rejectUnauthorized, true);
  assert.equal(sender.calls.options.disableFileAccess, true);
  assert.equal(sender.calls.message.html, input.html);
  assert.deepEqual(sender.calls.message.from, { name: input.senderName, address: 'noreply@example.com' });
  assert.equal(sender.calls.message.replyTo, input.replyTo);
  assert.equal(sender.calls.closed, true);
});
test('missing SES credentials stop marketing; arbitrary hosts and plaintext ports never receive credentials', async () => {
  const missing = smtp(() => { throw Error('must not send'); }, { SES_SMTP_PASSWORD: '' });
  assert.equal((await missing.trySesSmtpEmail(input)).status, 'failed');
  for (const overrides of [{ SES_SMTP_HOST: 'attacker.example.com' }, { SES_SMTP_PORT: '25' }]) {
    const invalid = smtp(() => { throw Error('must not send'); }, overrides);
    assert.equal((await invalid.trySesSmtpEmail(input)).status, 'failed');
    assert.equal(invalid.calls.options, null);
  }
});
test('SES explicit temporary rejection and pre-submission failure permit backup', async () => {
  for (const details of [{ responseCode: 454, command: 'DATA' }, { code: 'EAUTH' }, { code: 'ESOCKET', command: 'CONN' }]) {
    const sender = smtp(async () => { throw Object.assign(Error('mock'), details); });
    assert.equal((await sender.trySesSmtpEmail(input)).status, 'fallback');
    assert.equal(sender.calls.closed, true);
  }
});
test('uncertain DATA acceptance and recipient/policy rejection do not trigger duplicates or bypass', async () => {
  for (const details of [{ code: 'ETIMEDOUT', command: 'DATA' }, { responseCode: 550, command: 'RCPT TO' }, { responseCode: 554, command: 'DATA' }]) {
    assert.equal((await smtp(async () => { throw Object.assign(Error('mock'), details); }).trySesSmtpEmail(input)).status, 'failed');
  }
  assert.equal((await smtp(async () => ({})).trySesSmtpEmail(input)).status, 'failed');
});
test('STARTTLS remains mandatory when port 587 is selected', async () => {
  const sender = smtp(async () => ({ accepted: ['buyer@example.com'], messageId: 'mock' }), { SES_SMTP_PORT: '587' });
  await sender.trySesSmtpEmail(input);
  assert.equal(sender.calls.options.secure, false);
  assert.equal(sender.calls.options.requireTLS, true);
});

test('Mail Manager ingress endpoints use authenticated STARTTLS on port 587', async () => {
  const sender = smtp(async () => ({ accepted: ['buyer@example.com'], messageId: 'mock' }), {
    SES_SMTP_HOST: 'example.fips.region.mail-manager-smtp.amazonaws.com', SES_SMTP_PORT: '587',
  });
  assert.equal((await sender.trySesSmtpEmail(input)).status, 'accepted');
  assert.equal(sender.calls.options.secure, false);
  assert.equal(sender.calls.options.requireTLS, true);
  const wrongPort = smtp(() => { throw Error('must not send'); }, {
    SES_SMTP_HOST: 'example.fips.region.mail-manager-smtp.amazonaws.com', SES_SMTP_PORT: '465',
  });
  assert.equal((await wrongPort.trySesSmtpEmail(input)).status, 'failed');
});
test('Resend backup fails honestly without configuration and never logs credentials', async () => {
  const backup = load('src/lib/server/email/resend-fallback.ts', { 'server-only': {}, '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: () => '' } });
  assert.equal((await backup.sendResendFallback(input)).success, false);
});

test('Resend backup retries reuse an idempotency key and preserve unsubscribe HTML', async () => {
  const original = globalThis.fetch;
  const keys = [];
  const backup = load('src/lib/server/email/resend-fallback.ts', { 'server-only': {}, '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: key => key === 'RESEND_API_KEY' ? 'unit-test-placeholder' : '' } });
  globalThis.fetch = async (_url, options) => {
    keys.push(options.headers['Idempotency-Key']);
    assert.equal(JSON.parse(options.body).html, input.html);
    return new Response('', { status: keys.length === 1 ? 503 : 200 });
  };
  try {
    assert.equal((await backup.sendResendFallback(input)).success, true);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
  } finally { globalThis.fetch = original; }
});
