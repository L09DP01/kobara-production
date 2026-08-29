export const MOBILE_APP_ORIGIN = 'https://app.kobara.app';

const DEFAULT_PUBLIC_API_ORIGINS = [
  'https://kobara.app',
  'https://dashboard.kobara.app',
  'https://pay.kobara.app',
  MOBILE_APP_ORIGIN,
];

const PUBLIC_API_CORS_BASE_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Client, X-Requested-With',
  'Access-Control-Expose-Headers': 'Idempotency-Key, X-Idempotency-Cached, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After',
  'Access-Control-Max-Age': '86400',
} as const;

export function getPublicApiCorsHeaders(origin: string | null) {
  return {
    ...PUBLIC_API_CORS_BASE_HEADERS,
    'Access-Control-Allow-Origin': origin || '*',
    Vary: 'Origin',
  } as const;
}

export const MOBILE_API_CORS_HEADERS = {
  'Access-Control-Allow-Origin': MOBILE_APP_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Client, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
} as const;

export function applyCorsHeaders(
  response: Response,
  headers: Readonly<Record<string, string>>,
) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
