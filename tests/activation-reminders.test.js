import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activationReminderEmail } from '../src/lib/activation-reminder-email.ts';

test('KYC reminder links to verification and does not ask for documents by email', () => {
  const email = activationReminderEmail('kyc', '<script>bad</script>');
  assert.match(email.text, /dashboard.kobara.app\/kyc/);
  assert.match(email.text, /inutile de les renvoyer/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
});
test('first payment reminder has no subscription sale or unverified fee promise', () => {
  const email = activationReminderEmail('first_payment', 'Boutique');
  assert.match(email.text, /dashboard.kobara.app\/payment-links/);
  assert.match(email.text, /désactiver/);
  assert.doesNotMatch(email.text, /Premium|Pro\b|2,9|instantané/);
});
test('persistent cycle excludes test and internal payments and enforces delivery leases', () => {
  const sql = readFileSync('supabase/migrations/20261015150245_merchant_activation_email_cycle.sql', 'utf8');
  for (const pattern of [/INTERVAL '3 days'/, /SKIP LOCKED/, /p.environment = 'live'/, /is_subscription_upgrade/, /NOT IN \('b2b', 'system_subscription'\)/, /activation_reminders' = 'false'/, /u.email_verified = true/, /completed_at IS NULL/]) assert.match(sql, pattern);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
});
test('cron requires a real secret and old KYC cron shares the new cycle', () => {
  assert.match(readFileSync('src/app/api/cron/merchant-activation/route.ts', 'utf8'), /!process.env.CRON_SECRET/);
  assert.match(readFileSync('src/app/api/cron/kyc-reminders/route.ts', 'utf8'), /merchant-activation/);
});
