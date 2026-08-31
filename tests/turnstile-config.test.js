import assert from 'node:assert/strict';
import test from 'node:test';

import { getTurnstileSecretKey } from '../src/lib/server/security/turnstile.ts';

test('Turnstile accepts the documented and Cloudflare-compatible secret names', () => {
  assert.equal(getTurnstileSecretKey({ TURNSTILE_SECRET_KEY: ' primary ' }), 'primary');
  assert.equal(getTurnstileSecretKey({ CLOUDFLARE_TURNSTILE_SECRET_KEY: 'cloudflare' }), 'cloudflare');
  assert.equal(getTurnstileSecretKey({ TURNSTILE_SECRET: 'legacy' }), 'legacy');
  assert.equal(getTurnstileSecretKey({}), '');
});
