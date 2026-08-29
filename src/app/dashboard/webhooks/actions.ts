'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

function getCurrentEnvironment(merchant: { current_environment?: string | null }) {
  return merchant.current_environment === 'live' ? 'live' as const : 'test' as const;
}

function normalizeWebhookUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("L'URL de l'endpoint webhook est invalide.");
  }
  if (parsed.protocol !== 'https:') {
    throw new Error("L'endpoint webhook doit utiliser HTTPS.");
  }
  parsed.hash = '';
  return parsed.toString();
}

export async function addWebhookEndpoint(url: string) {
  const { merchant } = await getCurrentUserAndMerchant();
  const supabaseAdmin = createAdminClient();
  const environment = getCurrentEnvironment(merchant);
  const normalizedUrl = normalizeWebhookUrl(url);

  // Generate a webhook secret for HMAC signing
  const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

  const { error } = await supabaseAdmin
    .from('webhook_endpoints')
    .insert({
      merchant_id: merchant.id,
      environment,
      url: normalizedUrl,
      secret: secret,
      status: 'active'
    });

  if (error) {
    throw new Error("Failed to create webhook endpoint");
  }

  revalidatePath('/dashboard/webhooks');
}

export async function deleteWebhookEndpoint(id: string) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const supabaseAdmin = createAdminClient();
  const environment = getCurrentEnvironment(merchant);

  // Find endpoint to verify ownership (RLS allows select)
  const { data: endpoint } = await supabase
    .from('webhook_endpoints')
    .select('merchant_id, environment')
    .eq('id', id)
    .eq('environment', environment)
    .single();

  if (!endpoint || endpoint.merchant_id !== merchant.id || endpoint.environment !== environment) {
    throw new Error("Webhook endpoint not found ou accès refusé");
  }

  const { error } = await supabaseAdmin
    .from('webhook_endpoints')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .eq('environment', environment);

  if (error) {
    throw new Error("Failed to delete webhook endpoint");
  }

  revalidatePath('/dashboard/webhooks');
}


export async function resendWebhookEvent(eventId: string) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const environment = getCurrentEnvironment(merchant);

  const { data: event } = await supabase
    .from('webhook_events')
    .select('id, merchant_id, webhook_endpoint_id, environment, event_type, payload, retry_count')
    .eq('id', eventId)
    .eq('environment', environment)
    .single();

  if (!event || event.merchant_id !== merchant.id || event.environment !== environment) {
    throw new Error('Event not found or access denied');
  }
  if (!event.webhook_endpoint_id) {
    throw new Error("Cet ancien événement n'est pas lié à un endpoint précis et ne peut pas être renvoyé.");
  }

  const { dispatchMerchantWebhook } = await import("@/lib/server/webhooks/dispatcher");
  const payloadData = event.payload?.data || event.payload || {};

  const results = await dispatchMerchantWebhook({
    merchantId: merchant.id,
    environment,
    eventType: event.event_type || 'payment.succeeded',
    data: payloadData,
    endpointId: event.webhook_endpoint_id,
    retryCount: Number(event.retry_count || 0) + 1,
    deduplicationKey: null,
  });

  revalidatePath('/dashboard/webhooks');
  const result = results[0];
  if (!result) throw new Error("L'endpoint associé est inactif ou introuvable.");
  return result;
}

export async function testWebhookEndpoint(endpointId: string) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const environment = getCurrentEnvironment(merchant);

  const { data: endpoint } = await supabase
    .from('webhook_endpoints')
    .select('id, merchant_id, environment, status')
    .eq('id', endpointId)
    .eq('environment', environment)
    .single();

  if (!endpoint || endpoint.merchant_id !== merchant.id || endpoint.environment !== environment) {
    throw new Error("Webhook endpoint introuvable ou accès refusé");
  }

  const { dispatchMerchantWebhook } = await import("@/lib/server/webhooks/dispatcher");

  const results = await dispatchMerchantWebhook({
    merchantId: merchant.id,
    environment,
    eventType: 'webhook.test',
    data: {
      id: `evt_test_${crypto.randomUUID()}`,
      reference: `KOBTEST${Math.floor(100000 + Math.random() * 900000)}`,
      amount: 1500,
      net_amount: 1456.5,
      fee_amount: 43.5,
      currency: 'HTG',
      status: 'succeeded',
      provider: 'moncash',
      payment_method: 'moncash_test',
      paid_at: new Date().toISOString(),
      metadata: { is_test_simulation: true },
    },
    endpointId,
    deduplicationKey: null,
  });

  revalidatePath('/dashboard/webhooks');
  return results[0] || { success: false, error: 'No endpoint matched' };
}
