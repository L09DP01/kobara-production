import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SESSION_INACTIVITY_TIMEOUT_MS,
  isSessionInactive,
} from '../src/lib/session-inactivity.ts';

test('a session remains active before 20 minutes', () => {
  const now = 1_800_000;
  assert.equal(isSessionInactive(now - SESSION_INACTIVITY_TIMEOUT_MS + 1, now), false);
});

test('a session expires at 20 minutes of inactivity', () => {
  const now = 1_800_000;
  assert.equal(isSessionInactive(now - SESSION_INACTIVITY_TIMEOUT_MS, now), true);
});

test('a missing activity timestamp is migrated without expiring the session', () => {
  assert.equal(isSessionInactive(undefined), false);
});

test('an invalid activity timestamp expires the session', () => {
  assert.equal(isSessionInactive('not-a-timestamp'), true);
});
