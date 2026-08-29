export type WebhookEnvironment = 'test' | 'live';

export type WebhookEndpointCandidate = {
  id: string;
  merchant_id: string;
  url: string;
  secret: string;
  environment: string | null;
  status: string | null;
};

export type WebhookEventPayload = {
  event_type: string;
  environment: WebhookEnvironment;
  timestamp: number;
  data: Record<string, unknown> & { environment: WebhookEnvironment };
};

export function isWebhookEnvironment(value: unknown): value is WebhookEnvironment {
  return value === 'test' || value === 'live';
}

export function filterWebhookEndpoints(
  endpoints: WebhookEndpointCandidate[],
  merchantId: string,
  environment: WebhookEnvironment,
  endpointId?: string,
) {
  return endpoints.filter((endpoint) => (
    endpoint.merchant_id === merchantId
    && endpoint.environment === environment
    && endpoint.status === 'active'
    && (!endpointId || endpoint.id === endpointId)
  ));
}

export function buildWebhookPayload(
  eventType: string,
  environment: WebhookEnvironment,
  data: Record<string, unknown>,
  timestamp: number,
): WebhookEventPayload {
  return {
    event_type: eventType,
    environment,
    timestamp,
    data: {
      ...data,
      environment,
    },
  };
}

export function buildWebhookEventKey(
  merchantId: string,
  endpointId: string,
  environment: WebhookEnvironment,
  deduplicationKey: string | null,
) {
  if (!deduplicationKey) return null;
  return `${merchantId}:${endpointId}:${environment}:${deduplicationKey}`;
}
