import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isPromotionSegment, promotionToken, validPromotionToken, validatePromotionCopy } from '../src/lib/smart-promotions.ts';

test('only the three reviewed audiences are accepted', () => {
  for (const segment of ['links_no_payment', 'api_not_started', 'inactive30']) assert.equal(isPromotionSegment(segment), true);
  for (const segment of ['all', '__proto__', 'customers', 'kyc_documents']) assert.equal(isPromotionSegment(segment), false);
});
test('copy cannot introduce unsupported prices, offers, links or HTML', () => {
  assert.equal(validatePromotionCopy({ subject: 'Votre lien est prêt', body: 'Partagez votre lien avec vos clients.' }).subject, 'Votre lien est prêt');
  for (const body of ['Tarif 2,9%', '<img src=x>', 'https://evil.test', 'Tout est gratuit', 'Retrait instantané', 'Offre limitée']) assert.throws(() => validatePromotionCopy({ subject: 'Bonjour', body }));
});
test('unsubscribe tokens are scoped, tamper resistant and contain no email', () => {
  const secret = randomBytes(32).toString('hex');
  const id = '11111111-2222-4333-8444-555555555555';
  const token = promotionToken(id, secret);
  assert.equal(validPromotionToken(token, secret), id);
  assert.equal(validPromotionToken(token.replace('11111111', '11111112'), secret), null);
  assert.equal(validPromotionToken(token, randomBytes(32).toString('hex')), null);
  assert.equal(validPromotionToken(`${token}.extra`, secret), null);
  assert.throws(() => promotionToken(id, ''));
  assert.doesNotMatch(token, /@/);
});
test('database gates promotions on consent, approval, cooldown and current account state', () => {
  const sql = readFileSync('supabase/migrations/20261015152938_smart_promotions.sql', 'utf8');
  for (const pattern of [/marketing_promotions'='true'/, /INTERVAL '14 days'/, /status='approved'/, /ORDER BY random\(\)/, /FOR UPDATE SKIP LOCKED/, /pg_advisory_xact_lock/, /support_tickets/, /merchant_activation_reminders/, /lower\(m.email\)=r.email/, /FROM PUBLIC,anon,authenticated/]) assert.match(sql, pattern);
  assert.match(readFileSync('src/lib/server/messaging/smart-promotions.ts', 'utf8'), /validate_smart_promotion_recipient/);
});
test('scheduling processes approved work but never generates or approves campaigns', () => {
  const route = readFileSync('src/app/api/cron/smart-promotions/route.ts', 'utf8');
  assert.match(route, /!process.env.CRON_SECRET/);
  assert.doesNotMatch(route, /generatePromotion|setPromotionStatus/);
  const unsubscribe = readFileSync('src/app/promotions/unsubscribe/page.tsx', 'utf8');
  assert.match(unsubscribe, /'use server'/);
  assert.match(unsubscribe, /validPromotionToken\(token/);
});
