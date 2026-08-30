import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { updateSession } from '@/utils/supabase/middleware';
import {
  applyCorsHeaders,
  getPublicApiCorsHeaders,
  MOBILE_API_CORS_HEADERS,
  MOBILE_APP_ORIGIN,
} from '@/lib/http/api-cors';
import {
  DEFAULT_MAINTENANCE_STATE,
  isMaintenanceBypassPath,
  isMaintenanceActive,
  maintenanceRetryAfter,
  normalizeMaintenanceState,
} from '@/lib/maintenance-state';

async function readMaintenanceState() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return DEFAULT_MAINTENANCE_STATE;

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?key=eq.platform_maintenance&select=value,updated_at,updated_by`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(1500),
      },
    );
    if (!response.ok) return DEFAULT_MAINTENANCE_STATE;
    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return normalizeMaintenanceState({
      ...(row?.value || {}),
      updated_at: row?.updated_at,
      updated_by: row?.updated_by,
    });
  } catch {
    return DEFAULT_MAINTENANCE_STATE;
  }
}

// Initialize Redis only if the URL is provided (prevents crashing if env is missing)
const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

// Create a new ratelimiter, that allows 60 requests per 1 minute for general pages/auth
const ratelimit = redis 
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
    })
  : null;

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostHeader = request.headers.get("host") || request.nextUrl.hostname || "";
  const hostname = hostHeader.split(":")[0].trim();
  const requestOrigin = request.headers.get('origin');
  const isApiHostname = hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local";
  const routedPathname = isApiHostname && !url.pathname.startsWith('/api/')
    ? `/api${url.pathname}`
    : url.pathname;

  if (!isMaintenanceBypassPath(routedPathname)) {
    const maintenance = await readMaintenanceState();
    if (isMaintenanceActive(maintenance)) {
      const isApiPath = routedPathname.startsWith('/api');
      if (isApiPath) {
        const response = NextResponse.json(
          {
            error: 'system_maintenance',
            message: maintenance.maintenance_message,
            scheduled_for: maintenance.scheduled_for,
          },
          {
            status: 503,
            headers: {
              'Retry-After': String(maintenanceRetryAfter(maintenance)),
              'Cache-Control': 'no-store',
            },
          },
        );
        const maintenanceCorsHeaders = routedPathname.startsWith('/api/v1')
          ? getPublicApiCorsHeaders(requestOrigin)
          : requestOrigin === MOBILE_APP_ORIGIN
            ? MOBILE_API_CORS_HEADERS
            : null;
        return maintenanceCorsHeaders
          ? applyCorsHeaders(response, maintenanceCorsHeaders)
          : response;
      }
      return NextResponse.redirect(new URL('/maintenance', request.url), 307);
    }
  }

  // 1. API Subdomain Routing
  if (isApiHostname) {
    // Root endpoint for the API subdomain
    if (url.pathname === "/") {
      return NextResponse.json({
        name: "Kobara API",
        version: "v1",
        docs: "https://docs.kobara.app/docs/quickstart",
        status: "active"
      });
    }

    // Automatically prefix with /api if not present so /v1/payments maps to /api/v1/payments
    if (!url.pathname.startsWith("/api/")) {
      url.pathname = `/api${url.pathname}`;
    }
  }

  const isApiRequest = url.pathname.startsWith('/api') || hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local";
  const isV1Api = url.pathname.startsWith('/api/v1');
  const isVerifiedProviderWebhook = url.pathname === '/api/webhooks/resend-inbound';
  const corsHeaders = isV1Api
    ? getPublicApiCorsHeaders(requestOrigin)
    : requestOrigin === MOBILE_APP_ORIGIN
      ? MOBILE_API_CORS_HEADERS
      : null;

  if (isApiRequest && request.method === 'OPTIONS') {
    if (!corsHeaders) {
      return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 });
    }
    return applyCorsHeaders(new NextResponse(null, { status: 204 }), corsHeaders);
  }

  // 2. Rate Limiting
  if (isApiRequest) {

    // For /api/v1 API endpoints, IP-based rate limiting is bypassed so that rate limits are strictly enforced by Merchant Plan (Free: 60, Pro: 300, Premium: 1000, Business: 3000)
    if (isV1Api) {
      if (hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local") {
        const response = NextResponse.rewrite(url);
        return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
      }
      const response = NextResponse.next();
      return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
    }

    if (isVerifiedProviderWebhook) {
      return NextResponse.next();
    }

    if (ratelimit) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'anonymous';
      
      try {
        const { success, limit, reset, remaining } = await ratelimit.limit(ip);
        
        if (!success) {
          const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
          const response = new NextResponse(
            JSON.stringify({ error: "Too Many Requests. Please slow down." }),
            { 
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': retryAfter.toString(),
                'X-RateLimit-Limit': limit.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': reset.toString(),
              }
            }
          );
          return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
        }
        
        // Rate limit OK.
        if (hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local") {
          const rewriteResponse = NextResponse.rewrite(url);
          rewriteResponse.headers.set('X-RateLimit-Limit', limit.toString());
          rewriteResponse.headers.set('X-RateLimit-Remaining', remaining.toString());
          rewriteResponse.headers.set('X-RateLimit-Reset', reset.toString());
          return corsHeaders ? applyCorsHeaders(rewriteResponse, corsHeaders) : rewriteResponse;
        }

        const nextResponse = NextResponse.next();
        nextResponse.headers.set('X-RateLimit-Limit', limit.toString());
        nextResponse.headers.set('X-RateLimit-Remaining', remaining.toString());
        nextResponse.headers.set('X-RateLimit-Reset', reset.toString());
        return corsHeaders ? applyCorsHeaders(nextResponse, corsHeaders) : nextResponse;
        
      } catch (error) {
        console.error("Rate limiting error:", error);
        if (hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local") {
          const response = NextResponse.rewrite(url);
          return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
        }
      }
    } else if (hostname === "api.kobara.app" || hostname?.startsWith("api.localhost") || hostname === "api.kobara.local") {
      const response = NextResponse.rewrite(url);
      return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
    }
  }

  // 3. Regular application routing (Supabase Auth Middleware & NextAuth)
  const response = await updateSession(request);
  return corsHeaders ? applyCorsHeaders(response, corsHeaders) : response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
