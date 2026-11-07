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
  const defaults = {
    './email/template': () => load('src/lib/server/email/template.ts', {}),
    './email/resend-fallback': () => load('src/lib/server/email/resend-fallback.ts', {
      'server-only': {}, '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: key => process.env[key] || '' },
    }),
  };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name in defaults ? defaults[name]() : require(name), module, module.exports);
  return module.exports;
}
const input = { to: 'buyer@example.com', subject: 'Order', html: '<p>Order</p>', text: 'Order', senderName: 'Example Store', replyTo: 'support@example.com' };
function adapter(send, env = {}) {
  return load('src/lib/server/email/cloudflare.ts', {
    'server-only': {},
    '@opennextjs/cloudflare': { getCloudflareContext: () => ({ env: { EMAIL: send ? { send } : undefined } }) },
    '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: key => env[key] || '' },
  });
}
test('Cloudflare preserves merchant sender and reply-to', async () => {
  let payload;
  const result = await adapter(async data => { payload = data; return { messageId: 'mock-message' }; }).tryCloudflareEmail(input);
  assert.equal(result.status, 'accepted');
  assert.deepEqual(payload.from, { email: 'noreply@kobara.app', name: 'Example Store' });
  assert.equal(payload.replyTo, input.replyTo);
  assert.equal(payload.text, input.text);
});
test('missing binding falls back but Resend cannot be forced ahead of Cloudflare', async () => {
  assert.equal((await adapter().tryCloudflareEmail(input)).status, 'fallback');
  assert.equal((await adapter(async () => ({ messageId: 'mock' }), { EMAIL_PRIMARY_PROVIDER: 'resend' }).tryCloudflareEmail(input)).status, 'accepted');
});
test('explicit quota and sender errors allow fallback', async () => {
  for (const code of ['E_DAILY_LIMIT_EXCEEDED', 'E_RATE_LIMIT_EXCEEDED', 'E_SENDER_NOT_VERIFIED', 'E_DELIVERY_FAILED']) {
    assert.equal((await adapter(async () => { throw Object.assign(Error('mock'), { code }); }).tryCloudflareEmail(input)).status, 'fallback');
  }
});
test('suppression and ambiguous outcomes do not send a second copy', async () => {
  for (const code of ['E_RECIPIENT_SUPPRESSED', 'E_RECIPIENT_NOT_ALLOWED', 'E_ACCOUNT_SUSPENDED', '']) {
    assert.equal((await adapter(async () => { throw Object.assign(Error('mock'), { code }); }).tryCloudflareEmail(input)).status, 'failed');
  }
  assert.equal((await adapter(async () => ({})).tryCloudflareEmail(input)).status, 'failed');
});
test('transactional transport selection and review suppression', async () => {
  const previous = process.env.RESEND_API_KEY;
  const fetchOriginal = globalThis.fetch;
  process.env.RESEND_API_KEY = 'unit-test-placeholder';
  let cloudCalls = 0, resendCalls = 0, sesCalls = 0, status = 'accepted', primaryHtml, fallbackHtml;
  globalThis.fetch = async (_url, options) => { resendCalls++; fallbackHtml = JSON.parse(options.body).html; return { ok: true }; };
  try {
    const mail = load('src/lib/server/mail.ts', {
      '@/lib/review-account': { isReviewEmail: to => to === 'test@shopify.com', isReviewAccount: () => false },
      '@/auth': { auth: async () => null },
      './email/cloudflare': { tryCloudflareEmail: async payload => { cloudCalls++; primaryHtml = payload.html; return { status, error: 'mock error' }; } },
      './email/ses-smtp': { trySesSmtpEmail: async () => { sesCalls++; return { status: 'accepted' }; } },
    });
    assert.equal((await mail.sendEmail(input)).success, true);
    assert.equal(resendCalls, 0);
    assert.match(primaryHtml, /data-template="message"/);
    status = 'fallback';
    assert.equal((await mail.sendEmail(input)).success, true);
    assert.equal(resendCalls, 1);
    assert.equal(fallbackHtml, primaryHtml);
    status = 'failed';
    assert.equal((await mail.sendEmail(input)).success, false);
    assert.equal(resendCalls, 1);
    assert.equal((await mail.sendEmail({ ...input, kind: 'marketing' })).success, true);
    assert.equal(cloudCalls, 3);
    assert.equal(sesCalls, 1);
    assert.equal(resendCalls, 1);
    await mail.sendEmail({ ...input, to: 'test@shopify.com' });
    assert.equal(cloudCalls, 3);
    assert.equal(resendCalls, 1);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
  }
});
test('guide destinations exist and marketing remains explicitly classified', () => {
  const guide = read('src/components/dashboard/setup-guide.tsx');
  const actions = read('src/app/dashboard/setup-guide/actions.ts');
  assert.match(actions, /redirect\(choice === 'api' \? '\/api-keys' : '\/payment-links\/create'\)/);
  assert.doesNotMatch(guide, /href: [^\n]*'\/dashboard\//);
  for (const path of ['/settings', '/kyc', '/webhooks', '/payment-links', '/api-keys']) {
    assert.ok(guide.includes(path));
    assert.ok(fs.existsSync(new URL('../src/app/dashboard' + path + '/page.tsx', import.meta.url)));
  }
  for (const file of ['campaign-service.ts', 'smart-promotions.ts']) {
    assert.match(read('src/lib/server/messaging/' + file), /kind: 'marketing'/);
  }
});

test('marketing uses SES first and calls Resend only on a definite fallback', async () => {
  let status = 'accepted', primary = 0, backup = 0;
  const mail = load('src/lib/server/mail.ts', {
    '@/lib/review-account': { isReviewEmail: () => false, isReviewAccount: () => false },
    '@/auth': { auth: async () => null },
    './email/cloudflare': { tryCloudflareEmail: () => { throw Error('marketing must not use Cloudflare'); } },
    './email/ses-smtp': { trySesSmtpEmail: async () => { primary++; return { status, error: 'mock' }; } },
    './email/resend-fallback': { sendResendFallback: async () => { backup++; return { success: true }; } },
  });
  assert.equal((await mail.sendEmail({ ...input, kind: 'marketing' })).success, true);
  assert.equal(backup, 0);
  status = 'fallback';
  assert.equal((await mail.sendEmail({ ...input, kind: 'marketing' })).success, true);
  assert.equal(backup, 1);
  status = 'failed';
  assert.equal((await mail.sendEmail({ ...input, kind: 'marketing' })).success, false);
  assert.equal(backup, 1);
  assert.equal(primary, 3);
});

test('marketing preflight requires SES even when Resend is configured', async () => {
  let configured = false;
  const mail = load('src/lib/server/mail.ts', {
    '@/lib/review-account': {},
    './runtime-env': { getRuntimeEnvironmentValue: () => 'unit-test-resend-configured' },
    './email/ses-smtp': { hasSesSmtpConfiguration: () => configured },
    './email/cloudflare': { hasCloudflareEmailBinding: () => true },
  });
  assert.equal(await mail.isEmailDeliveryConfigured('marketing'), false);
  configured = true;
  assert.equal(await mail.isEmailDeliveryConfigured('marketing'), true);
  assert.equal(await mail.isEmailDeliveryConfigured('transactional'), true);
});

test('bulk mail selects primary per recipient and keeps stable backup keys across reordering', async () => {
  const keys = new Map();
  let cloudflare = 0;
  const mail = load('src/lib/server/mail.ts', {
    '@/lib/review-account': { isReviewEmail: () => false, isReviewAccount: () => false },
    '@/auth': { auth: async () => null },
    './email/cloudflare': { tryCloudflareEmail: async () => { cloudflare++; return { status: 'accepted' }; } },
    './email/ses-smtp': { trySesSmtpEmail: async () => ({ status: 'fallback' }) },
    './email/resend-fallback': { sendResendFallback: async payload => {
      if (keys.has(payload.to)) assert.equal(keys.get(payload.to), payload.idempotencyKey);
      keys.set(payload.to, payload.idempotencyKey);
      return { success: true };
    } },
  });
  const bulk = { subject: 'News', text: 'Example', idempotencyKey: 'mock-campaign' };
  assert.deepEqual(await mail.sendBulkEmail({ ...bulk, recipients: ['a@example.com', 'b@example.com', 'A@example.com'] }), { sent: 2, failed: 0, errors: [] });
  await mail.sendBulkEmail({ ...bulk, recipients: ['b@example.com', 'a@example.com'] });
  assert.equal(new Set(keys.values()).size, 2);
  assert.equal(cloudflare, 0);
  await mail.sendBulkEmail({ ...bulk, recipients: ['a@example.com'], kind: 'transactional' });
  assert.equal(cloudflare, 1);
});

test('clean CI builds generate Workers binding types before Next compilation', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.ok(scripts.prebuild.startsWith('npm run cf:typegen &&'));
  assert.match(scripts['cf:typegen'], /wrangler types --env-interface CloudflareEnv/);
  assert.match(scripts['cf:typegen'], /--strict-vars false cloudflare-env\.d\.ts/);
});
