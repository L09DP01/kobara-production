export const TELEGRAM_RETIRED_SUBSCRIPTION_MESSAGE = 'Les abonnements Kobara ne sont plus proposés. Aucun achat ni renouvellement ne sera effectué. Consultez les frais par transaction sur la page Tarifs.';

export function isRetiredTelegramSubscriptionCallback(value: unknown) {
  return typeof value === 'string'
    && /^(?:action:(?:subscription|subscribe|plans?|renew_subscription)$|(?:sub|subscribe|subscription)[:_])/.test(value);
}

export function isRetiredTelegramSubscriptionCommand(value: string) {
  const text = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const command = text.split(/\s/)[0].split('@')[0];
  return ['/subscribe', '/subscription', '/subscriptions', '/abonnement', '/abonnements', '/plan', '/plans', '/renew'].includes(command)
    || text.replace(/^[^a-z/]+/, '') === 'mon abonnement';
}

export function isRetiredTelegramSubscriptionState(value: unknown) {
  return typeof value === 'string' && /^(?:sub|subscribe|subscription|plan)(?:_|:|$)/.test(value);
}
