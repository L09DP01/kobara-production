import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRetiredTelegramSubscriptionCallback, isRetiredTelegramSubscriptionCommand, isRetiredTelegramSubscriptionState } from '../src/lib/telegram-retired-subscriptions.ts';

test('all old subscription payment buttons are retired, including balance and provider payments', () => {
  for (const value of ['action:subscription', 'sub:upgrade', 'sub:renew', 'sub_select:pro', 'sub_cycle:pro:monthly:upgrade', 'sub_pay:pro:monthly:balance', 'sub_pay:pro:monthly:moncash', 'sub_pay:pro:yearly:natcash', 'subscribe:pro', 'subscription:renew']) {
    assert.equal(isRetiredTelegramSubscriptionCallback(value), true, value);
  }
  for (const value of ['action:balance', 'action:b2b', 'action:withdraw', 'action:create_link', 'action:ask_ai', 'withdraw_method:moncash', 'withdraw_crypto:usdt', null]) {
    assert.equal(isRetiredTelegramSubscriptionCallback(value), false, String(value));
  }
});

test('old commands and stale sessions redirect to pricing without hijacking customer subscription questions', () => {
  for (const text of ['/subscribe', '/subscribe@KobaraPayBot', '/subscription', '/abonnement', '/plan pro', '/plans', '/renew', '⭐ Mon Abonnement']) assert.equal(isRetiredTelegramSubscriptionCommand(text), true, text);
  for (const text of ['/solde', '/retrait', '/b2b', '/cancel', 'Comment gérer les abonnements de mes clients ?']) assert.equal(isRetiredTelegramSubscriptionCommand(text), false, text);
  for (const step of ['subscription', 'subscription_payment', 'sub_checkout', 'plan_select']) assert.equal(isRetiredTelegramSubscriptionState(step), true);
  for (const step of ['withdraw_amount', 'b2b_otp', 'ai_question', undefined]) assert.equal(isRetiredTelegramSubscriptionState(step), false);
});

test('retired Telegram purchase code and subscription notifications cannot be reached', () => {
  const bot = readFileSync(new URL('../src/lib/server/telegram/telegram-bot.service.ts', import.meta.url), 'utf8');
  assert.match(bot, /if \(isRetiredTelegramSubscriptionCallback\(data\)\) return this\.showUsagePricing/);
  assert.match(bot, /isRetiredTelegramSubscriptionCommand\(text\)/);
  assert.doesNotMatch(bot, /purchase_subscription_from_balance|purchaseSubscriptionWithBalance|generateSubscriptionPaymentLink|getPlanBySlug|getMerchantSubscriptionEntitlement|showPlanUpgradeList|showPlanCycleSelection|showPlanMethodSelection/);
  assert.doesNotMatch(bot, /activation du plan Pro|Abonnement Mensuel/);
  assert.doesNotMatch(bot, /callback_data:\s*['"](?:action:(?:subscription|subscribe|plans?|renew_subscription)|(?:sub|subscribe|subscription)[:_])/);
  assert.doesNotMatch(bot, /text:\s*['"][^'"\n]*(?:Abonnement|Renouveler|Souscrire|Voir les tarifs)/i);
  const notifier = readFileSync(new URL('../src/lib/server/telegram/telegram-notifier.service.ts', import.meta.url), 'utf8');
  const settlement = readFileSync(new URL('../src/lib/server/payments/on-payment-succeeded.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(notifier, /notifySubscriptionActivated|ABONNEMENT ACTIVÉ/);
  assert.doesNotMatch(settlement, /notifySubscriptionActivated/);
  assert.match(settlement, /notifyPaymentReceived/);
});
