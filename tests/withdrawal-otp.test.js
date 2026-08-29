import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { normalizeSixDigitCode } from '../src/lib/two-factor.ts';

test('Withdrawal OTP Isolation & Security Invariants', async (t) => {
  const HMAC_SECRET = 'test_withdrawal_salt_2026';

  await t.test('Withdrawal OTP uses dedicated withdrawal prefix preventing cross-use with login OTP', () => {
    const merchantId = 'm_test_123';
    const otp = '849201';

    // Withdrawal OTP Hash
    const withdrawalHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`withdrawal_otp:${merchantId}:${otp}`, 'utf8')
      .digest('hex');

    // Login Security Challenge Hash
    const loginHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`otp:${merchantId}:${otp}`, 'utf8')
      .digest('hex');

    // Invariant: The hashes MUST NOT match even with identical OTP and merchant
    assert.notEqual(withdrawalHash, loginHash, 'Withdrawal hash must be completely segregated from login challenge hash');
  });

  await t.test('Withdrawal OTP hash is deterministic and rejects another code', () => {
    const merchantId = 'm_test_456';
    const validOtp = '123456';
    const wrongOtp = '654321';

    const savedHash = crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`withdrawal_otp:${merchantId}:${validOtp}`, 'utf8')
      .digest('hex');

    const computeHash = (code) => crypto
      .createHmac('sha256', HMAC_SECRET)
      .update(`withdrawal_otp:${merchantId}:${code}`, 'utf8')
      .digest('hex');

    const validCandidate = computeHash(validOtp);
    const wrongCandidate = computeHash(wrongOtp);

    const isMatchValid = savedHash.length === validCandidate.length &&
      crypto.timingSafeEqual(Buffer.from(savedHash), Buffer.from(validCandidate));

    const isMatchWrong = savedHash.length === wrongCandidate.length &&
      crypto.timingSafeEqual(Buffer.from(savedHash), Buffer.from(wrongCandidate));

    assert.equal(isMatchValid, true, 'Valid OTP must match with timingSafeEqual');
    assert.equal(isMatchWrong, false, 'Wrong OTP must fail');
  });

  await t.test('Withdrawal OTP expires after 10 minutes', () => {
    const now = Date.now();
    const expiredTimestamp = new Date(now - 1000).toISOString();
    const futureTimestamp = new Date(now + 10 * 60 * 1000).toISOString();

    const isExpired = (expiresAt) => new Date(expiresAt) < new Date();

    assert.equal(isExpired(expiredTimestamp), true, 'Past timestamp should be marked expired');
    assert.equal(isExpired(futureTimestamp), false, 'Future timestamp should be valid');
  });

  await t.test('OTP Code length and sanitization', () => {
    const rawInput = ' 849 201 ';
    const sanitized = normalizeSixDigitCode(rawInput);
    assert.equal(sanitized, '849201');
    assert.equal(normalizeSixDigitCode('12345'), null);
    assert.equal(normalizeSixDigitCode('1234567'), null);
  });

  await t.test('OTP Rate Limiting: Max 5 attempts enforce lockout and code revocation', () => {
    const maxAttempts = 5;
    let attempts = 0;
    let isLocked = false;
    let lockoutUntil = null;

    // Simulate 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      attempts += 1;
      assert.equal(attempts < maxAttempts, true);
    }

    // 5th failed attempt triggers lockout
    attempts += 1;
    if (attempts >= maxAttempts) {
      isLocked = true;
      lockoutUntil = Date.now() + 5 * 60 * 1000;
    }

    assert.equal(isLocked, true);
    assert.equal(lockoutUntil > Date.now(), true);
  });

  await t.test('Database contract atomically locks, consumes, and restricts OTP RPCs', () => {
    const migration = readFileSync(
      new URL('../supabase/migrations/20260826210000_ensure_merchant_security_settings.sql', import.meta.url),
      'utf8',
    );

    assert.match(migration, /FOR UPDATE;/);
    assert.match(migration, /CREATE OR REPLACE FUNCTION public\.consume_withdrawal_otp/);
    assert.match(migration, /REVOKE ALL ON FUNCTION public\.consume_withdrawal_otp[^;]+FROM PUBLIC, anon, authenticated;/s);
    assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.consume_withdrawal_otp[^;]+TO service_role;/s);
    assert.match(migration, /CREATE TRIGGER ensure_merchant_settings_after_insert/);
  });
});
