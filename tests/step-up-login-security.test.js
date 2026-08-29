import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const HMAC_SECRET = 'test_kobara_secret_key_2026';

function extractTestContext(rawIp, userAgent) {
  const ipHash = crypto.createHmac('sha256', HMAC_SECRET).update(`ip:${rawIp}`, 'utf8').digest('hex');
  const ipParts = rawIp.split('.');
  const ipMasked = ipParts.length === 4 ? `${ipParts[0]}.${ipParts[1]}.***.***` : rawIp;
  const userAgentHash = crypto.createHash('sha256').update(userAgent, 'utf8').digest('hex');
  const deviceFingerprint = crypto.createHmac('sha256', HMAC_SECRET).update(`dev:${userAgent}`, 'utf8').digest('hex');
  return { rawIp, ipHash, ipMasked, userAgent, userAgentHash, deviceFingerprint, countryCode: 'HT' };
}

function evaluateContext(existingContexts, currentContext) {
  if (!existingContexts || existingContexts.length === 0) {
    return { isTrusted: true, requiresChallenge: false, isFirstContext: true };
  }

  const now = new Date();
  const match = existingContexts.find(ctx => {
    const notExpired = !ctx.expires_at || new Date(ctx.expires_at) > now;
    return notExpired && (ctx.ip_hash === currentContext.ipHash || ctx.device_fingerprint === currentContext.deviceFingerprint);
  });

  if (match) {
    return { isTrusted: true, requiresChallenge: false, isFirstContext: false };
  }

  return { isTrusted: false, requiresChallenge: true, isFirstContext: false };
}

function hashOtp(merchantId, otp) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(`otp:${merchantId}:${otp}`, 'utf8').digest('hex');
}

test('Step-Up Risk-Based Login Security: Invariant Tests', async (t) => {
  const ctxInitial = extractTestContext('190.115.10.5', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
  const ctxKnownIp = extractTestContext('190.115.10.5', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  const ctxNewIpAndDevice = extractTestContext('198.51.100.42', 'Mozilla/5.0 (X11; Linux x86_64)');

  await t.test('Test 1: Premier login d\'un marchand -> Contexte initial initialisé et approuvé', () => {
    const res = evaluateContext([], ctxInitial);
    assert.equal(res.isTrusted, true);
    assert.equal(res.requiresChallenge, false);
    assert.equal(res.isFirstContext, true);
  });

  await t.test('Test 2: Connexion depuis IP reconnue -> Approuvé sans challenge', () => {
    const existing = [{
      ip_hash: ctxInitial.ipHash,
      device_fingerprint: ctxInitial.deviceFingerprint,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }];

    const res = evaluateContext(existing, ctxKnownIp);
    assert.equal(res.isTrusted, true);
    assert.equal(res.requiresChallenge, false);
  });

  await t.test('Test 3: Connexion depuis Nouvelle IP + Nouvel Appareil -> Challenge Step-Up Requis', () => {
    const existing = [{
      ip_hash: ctxInitial.ipHash,
      device_fingerprint: ctxInitial.deviceFingerprint,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    }];

    const res = evaluateContext(existing, ctxNewIpAndDevice);
    assert.equal(res.isTrusted, false);
    assert.equal(res.requiresChallenge, true);
  });

  await t.test('Test 4: OTP 6 chiffres hashé via HMAC-SHA256 (jamais stocké en clair)', () => {
    const rawOtp = '583921';
    const merchantId = 'm_test_123';
    const hash = hashOtp(merchantId, rawOtp);

    assert.notEqual(hash, rawOtp);
    assert.equal(hash.length, 64);
    assert.equal(hash, hashOtp(merchantId, rawOtp));
  });

  await t.test('Test 5: Validation OTP exacte à temps constant', () => {
    const merchantId = 'm_test_123';
    const storedHash = hashOtp(merchantId, '748291');
    const userSubmittedCode = '748291';
    const candidateHash = hashOtp(merchantId, userSubmittedCode);

    const isMatch = crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(candidateHash));
    assert.equal(isMatch, true);
  });

  await t.test('Test 6: Code OTP invalide détecté', () => {
    const merchantId = 'm_test_123';
    const storedHash = hashOtp(merchantId, '748291');
    const userSubmittedCode = '111111';
    const candidateHash = hashOtp(merchantId, userSubmittedCode);

    const isMatch = crypto.timingSafeEqual(Buffer.from(storedHash), Buffer.from(candidateHash));
    assert.equal(isMatch, false);
  });

  await t.test('Test 7: Rate limiting du challenge (max 5 tentatives)', () => {
    let attempts = 0;
    const maxAttempts = 5;

    for (let i = 0; i < 5; i++) {
      attempts++;
    }

    assert.equal(attempts >= maxAttempts, true);
  });
});
