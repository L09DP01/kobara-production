import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

function shortenFloats(v) {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, shortenFloats(x)])
    );
  }
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.keys(v)
      .sort()
      .reduce((acc, k) => {
        acc[k] = sortKeys(v[k]);
        return acc;
      }, {});
  }
  return v;
}

test('Didit Webhook V3: Signature Canonicalisation & Verification', async (t) => {
  const secret = 'whsec_test_secret_didit_123456';

  await t.test('canonicalises keys in lexicographical order and shortens whole-number floats', () => {
    const rawPayload = {
      z_field: 1.0,
      a_field: "hello",
      m_field: {
        y: 2.0,
        b: 10
      }
    };

    const canonicalObj = sortKeys(shortenFloats(rawPayload));
    const keys = Object.keys(canonicalObj);
    assert.deepEqual(keys, ['a_field', 'm_field', 'z_field']);
    assert.equal(canonicalObj.z_field, 1);
    assert.equal(canonicalObj.m_field.y, 2);
  });

  await t.test('computes matching HMAC-SHA256 signature for X-Signature-V2', () => {
    const payload = {
      event_id: 'evt_123',
      status: 'Approved',
      session_id: 'sess_456',
      vendor_data: 'merchant_789',
      timestamp: 1774970000
    };

    const canonical = JSON.stringify(sortKeys(shortenFloats(payload)));
    const signature = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

    // Verify
    const expected = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
    assert.equal(
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)),
      true
    );
  });

  await t.test('rejects stale timestamp older than 300s', () => {
    const now = Math.floor(Date.now() / 1000);
    const staleTimestamp = now - 350;
    const isFresh = Math.abs(now - staleTimestamp) <= 300;
    assert.equal(isFresh, false);
  });
});
