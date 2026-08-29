import 'server-only';

import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  buildWebhookEventKey,
  buildWebhookPayload,
  filterWebhookEndpoints,
  isWebhookEnvironment,
  type WebhookEnvironment,
} from '@/lib/webhooks';

export interface DispatchWebhookOptions {
  merchantId: string;
  environment: WebhookEnvironment;
  eventType: string;
  data: Record<string, unknown>;
  endpointId?: string;
  retryCount?: number;
  // undefined derives a stable event key; null explicitly permits a manual resend.
  deduplicationKey?: string | null;
}

export interface DispatchResult {
  endpointId: string;
  eventId?: string;
  url: string;
  success: boolean;
  skipped?: boolean;
  statusCode?: number;
  error?: string;
  latencyMs?: number;
}

async function readResponsePreview(response: Response, limit = 2_000) {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let preview = '';

  try {
    while (preview.length < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      preview += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return preview.slice(0, limit);
}

export async function dispatchMerchantWebhook(options: DispatchWebhookOptions): Promise<DispatchResult[]> {
  const {
    merchantId,
    environment,
    eventType,
    data,
    endpointId,
    retryCount = 0,
  } = options;

  if (!merchantId || !eventType || !isWebhookEnvironment(environment)) {
    throw new Error('Invalid webhook dispatch context');
  }

  const supabase = createAdminClient();
  let endpointQuery = supabase
    .from('webhook_endpoints')
    .select('id, merchant_id, url, secret, environment, status')
    .eq('merchant_id', merchantId)
    .eq('environment', environment)
    .eq('status', 'active');

  if (endpointId) endpointQuery = endpointQuery.eq('id', endpointId);

  const { data: candidates, error: fetchError } = await endpointQuery;
  if (fetchError) {
    console.error(JSON.stringify({
      event: 'webhook_fetch_endpoints_failed',
      merchant_id: merchantId,
      environment,
      endpoint_id: endpointId || null,
      error: fetchError.message,
    }));
    throw new Error('Unable to load webhook endpoints');
  }

  const endpoints = filterWebhookEndpoints(candidates || [], merchantId, environment, endpointId);
  if (endpoints.length === 0) return [];

  const timestamp = Math.floor(Date.now() / 1000);
  const eventPayload = buildWebhookPayload(eventType, environment, data, timestamp);
  const payloadString = JSON.stringify(eventPayload);
  const inferredKey = typeof data.id === 'string' || typeof data.id === 'number'
    ? `${eventType}:${String(data.id)}`
    : null;
  const deduplicationKey = options.deduplicationKey === undefined
    ? inferredKey
    : options.deduplicationKey;

  return Promise.all(endpoints.map(async (endpoint): Promise<DispatchResult> => {
    const eventKey = buildWebhookEventKey(
      merchantId,
      endpoint.id,
      environment,
      deduplicationKey,
    );

    const { data: eventRecord, error: eventInsertError } = await supabase
      .from('webhook_events')
      .insert({
        merchant_id: merchantId,
        webhook_endpoint_id: endpoint.id,
        environment,
        event_type: eventType,
        event_key: eventKey,
        payload: eventPayload,
        delivery_status: 'pending',
        retry_count: retryCount,
      })
      .select('id')
      .single();

    if (eventInsertError?.code === '23505' && eventKey) {
      return {
        endpointId: endpoint.id,
        url: endpoint.url,
        success: true,
        skipped: true,
      };
    }

    if (eventInsertError || !eventRecord) {
      console.error(JSON.stringify({
        event: 'webhook_event_log_failed',
        merchant_id: merchantId,
        endpoint_id: endpoint.id,
        environment,
        error: eventInsertError?.message || 'Missing event record',
      }));
      return {
        endpointId: endpoint.id,
        url: endpoint.url,
        success: false,
        error: 'Unable to persist webhook attempt',
      };
    }

    const startedAt = Date.now();
    let responseStatus: number | null = null;
    let responseBody = '';
    let deliveryStatus: 'delivered' | 'failed' = 'failed';
    let deliveryError: string | undefined;

    try {
      const hmac = crypto
        .createHmac('sha256', endpoint.secret)
        .update(`${timestamp}.${payloadString}`)
        .digest('hex');

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Kobara-Signature': `t=${timestamp},v1=${hmac}`,
          'Kobara-Event': eventType,
          'Kobara-Environment': environment,
          'Kobara-Timestamp': timestamp.toString(),
          'User-Agent': 'Kobara-Webhook-Engine/1.0',
        },
        body: payloadString,
        signal: AbortSignal.timeout(10_000),
      });

      responseStatus = response.status;
      responseBody = await readResponsePreview(response);
      deliveryStatus = response.ok ? 'delivered' : 'failed';
      if (!response.ok) deliveryError = `HTTP ${response.status}`;
    } catch (error) {
      deliveryError = error instanceof Error ? error.message : 'Network error';
      responseBody = deliveryError;
    }

    const latencyMs = Date.now() - startedAt;
    const { error: eventUpdateError } = await supabase
      .from('webhook_events')
      .update({
        delivery_status: deliveryStatus,
        response_status: responseStatus,
        response_body: responseBody || null,
        next_retry_at: deliveryStatus === 'failed'
          ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
          : null,
      })
      .eq('id', eventRecord.id)
      .eq('merchant_id', merchantId)
      .eq('environment', environment);

    if (eventUpdateError) {
      console.error(JSON.stringify({
        event: 'webhook_event_update_failed',
        webhook_event_id: eventRecord.id,
        error: eventUpdateError.message,
      }));
    }

    return {
      endpointId: endpoint.id,
      eventId: eventRecord.id,
      url: endpoint.url,
      success: deliveryStatus === 'delivered',
      statusCode: responseStatus ?? undefined,
      error: deliveryError,
      latencyMs,
    };
  }));
}
