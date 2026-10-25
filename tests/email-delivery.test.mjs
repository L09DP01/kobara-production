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
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : name === './email/template' ? load('src/lib/server/email/template.ts', {}) : require(name), module, module.exports);
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
test('missing binding and explicit Resend override fall back', async () => {
  assert.equal((await adapter().tryCloudflareEmail(input)).status, 'fallback');
  assert.equal((await adapter(() => { throw Error('must not send'); }, { EMAIL_PRIMARY_PROVIDER: 'resend' }).tryCloudflareEmail(input)).status, 'fallback');
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
  let cloudCalls = 0, resendCalls = 0, status = 'accepted';
  globalThis.fetch = async () => { resendCalls++; return { ok: true }; };
  try {
    const mail = load('src/lib/server/mail.ts', {
      '@/lib/review-account': { isReviewEmail: to => to === 'test@shopify.com', isReviewAccount: () => false },
      '@/auth': { auth: async () => null },
      './email/cloudflare': { tryCloudflareEmail: async () => { cloudCalls++; return { status, error: 'mock error' }; } },
    });
    assert.equal((await mail.sendEmail(input)).success, true);
    assert.equal(resendCalls, 0);
    status = 'fallback';
    assert.equal((await mail.sendEmail(input)).success, true);
    assert.equal(resendCalls, 1);
    status = 'failed';
    assert.equal((await mail.sendEmail(input)).success, false);
    assert.equal(resendCalls, 1);
    assert.equal((await mail.sendEmail({ ...input, kind: 'marketing' })).success, true);
    assert.equal(cloudCalls, 3);
    assert.equal(resendCalls, 2);
    await mail.sendEmail({ ...input, to: 'test@shopify.com' });
    assert.equal(cloudCalls, 3);
    assert.equal(resendCalls, 2);
  } finally {
    globalThis.fetch = fetchOriginal;
    if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous;
  }
});
test('guide destinations exist and marketing remains explicitly classified', () => {
  const guide = read('src/components/dashboard/setup-guide.tsx');
  assert.match(read('src/app/dashboard/setup-guide/actions.ts'), /redirect\(choice === 'api' \? '\/api-keys' : '\/payment-links\/create'\)/);
  assert.doesNotMatch(guide, /href: [^\n]*'\/dashboard\//);
  for (const path of ['/settings', '/kyc', '/webhooks', '/payment-links', '/api-keys']) {
    assert.ok(guide.includes(path));
    assert.ok(fs.existsSync(new URL('../src/app/dashboard' + path + '/page.tsx', import.meta.url)));
  }
  for (const file of ['campaign-service.ts', 'smart-promotions.ts']) {
    assert.match(read('src/lib/server/messaging/' + file), /kind: 'marketing'/);
  }
});

test('clean CI builds generate Workers binding types before Next compilation', () => {
  const scripts = JSON.parse(read('package.json')).scripts;
  assert.ok(scripts.prebuild.startsWith('npm run cf:typegen &&'));
  assert.match(scripts['cf:typegen'], /wrangler types --env-interface CloudflareEnv/);
  assert.match(scripts['cf:typegen'], /--strict-vars false cloudflare-env\.d\.ts/);
});
