import { Ratelimit } from "@upstash/ratelimit";
import { redis, hasRedis } from "../redis";

// ─────────────────────────────────────────────────────────────────────
// Memory-based rate limiter fallback (when Redis is unavailable)
// Uses a sliding window approach with individual request timestamps
// ─────────────────────────────────────────────────────────────────────

const requestLog = new Map<string, number[]>();

class MemoryRateLimiter {
  private maxLimit: number;
  private windowMs: number;

  constructor(maxLimit: number, windowMs: number) {
    this.maxLimit = maxLimit;
    this.windowMs = windowMs;
  }

  async limit(identifier: string) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create request log for this identifier
    let timestamps = requestLog.get(identifier) || [];

    // Remove expired timestamps (outside the window)
    timestamps = timestamps.filter(ts => ts > windowStart);

    if (timestamps.length >= this.maxLimit) {
      requestLog.set(identifier, timestamps);
      return {
        success: false,
        limit: this.maxLimit,
        remaining: 0,
        reset: Math.min(...timestamps) + this.windowMs
      };
    }

    // Record this request
    timestamps.push(now);
    requestLog.set(identifier, timestamps);

    return {
      success: true,
      limit: this.maxLimit,
      remaining: this.maxLimit - timestamps.length,
      reset: now + this.windowMs
    };
  }
}

// Periodically clean up stale entries to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    const maxWindow = 10 * 60 * 1000; // 10 minutes (largest window we use)
    for (const [key, timestamps] of requestLog.entries()) {
      const valid = timestamps.filter(ts => ts > now - maxWindow);
      if (valid.length === 0) {
        requestLog.delete(key);
      } else {
        requestLog.set(key, valid);
      }
    }
  }, 60_000); // Cleanup every minute
}

// ─────────────────────────────────────────────────────────────────────
// Safe rate limiter wrapper: tries Upstash Redis, falls back to memory
// ─────────────────────────────────────────────────────────────────────

class SafeRateLimiter {
  private upstashLimiter: Ratelimit;
  private memoryFallback: MemoryRateLimiter;

  constructor(upstashLimiter: Ratelimit, memoryFallback: MemoryRateLimiter) {
    this.upstashLimiter = upstashLimiter;
    this.memoryFallback = memoryFallback;
  }

  async limit(identifier: string) {
    try {
      return await this.upstashLimiter.limit(identifier);
    } catch (error) {
      console.error("Upstash RateLimit error, failing open to memory:", error);
      return await this.memoryFallback.limit(identifier);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Singleton instances per category
// ─────────────────────────────────────────────────────────────────────

let authLimiter: SafeRateLimiter | MemoryRateLimiter;
let apiLimiter: SafeRateLimiter | MemoryRateLimiter;
let paymentsLimiter: SafeRateLimiter | MemoryRateLimiter;
let paymentLinksLimiter: SafeRateLimiter | MemoryRateLimiter;
let withdrawalsLimiter: SafeRateLimiter | MemoryRateLimiter;
let webhooksTestLimiter: SafeRateLimiter | MemoryRateLimiter;
let mobileLimiter: SafeRateLimiter | MemoryRateLimiter;
let uploadLimiter: SafeRateLimiter | MemoryRateLimiter;
let aiChatLimiter: SafeRateLimiter | MemoryRateLimiter;
let billingLimiter: SafeRateLimiter | MemoryRateLimiter;

if (hasRedis && redis) {
  authLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "5 m"), analytics: true, prefix: "rl:auth" }),
    new MemoryRateLimiter(5, 5 * 60 * 1000)
  );

  apiLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, "1 m"), analytics: true, prefix: "rl:api" }),
    new MemoryRateLimiter(100, 60 * 1000)
  );

  paymentsLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "1 m"), analytics: true, prefix: "rl:payments" }),
    new MemoryRateLimiter(60, 60 * 1000)
  );

  paymentLinksLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "1 m"), analytics: true, prefix: "rl:paylinks" }),
    new MemoryRateLimiter(30, 60 * 1000)
  );

  withdrawalsLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), analytics: true, prefix: "rl:withdraw" }),
    new MemoryRateLimiter(10, 60 * 1000)
  );

  webhooksTestLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), analytics: true, prefix: "rl:webhooks" }),
    new MemoryRateLimiter(10, 60 * 1000)
  );

  mobileLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(120, "1 m"), analytics: true, prefix: "rl:mobile" }),
    new MemoryRateLimiter(120, 60 * 1000)
  );

  uploadLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), analytics: true, prefix: "rl:upload" }),
    new MemoryRateLimiter(10, 60 * 1000)
  );

  aiChatLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "1 m"), analytics: true, prefix: "rl:ai" }),
    new MemoryRateLimiter(20, 60 * 1000)
  );

  billingLimiter = new SafeRateLimiter(
    new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "1 m"), analytics: true, prefix: "rl:billing" }),
    new MemoryRateLimiter(10, 60 * 1000)
  );
} else {
  // Fallback memory rate limiters
  authLimiter = new MemoryRateLimiter(5, 5 * 60 * 1000);
  apiLimiter = new MemoryRateLimiter(100, 60 * 1000);
  paymentsLimiter = new MemoryRateLimiter(60, 60 * 1000);
  paymentLinksLimiter = new MemoryRateLimiter(30, 60 * 1000);
  withdrawalsLimiter = new MemoryRateLimiter(10, 60 * 1000);
  webhooksTestLimiter = new MemoryRateLimiter(10, 60 * 1000);
  mobileLimiter = new MemoryRateLimiter(120, 60 * 1000);
  uploadLimiter = new MemoryRateLimiter(10, 60 * 1000);
  aiChatLimiter = new MemoryRateLimiter(20, 60 * 1000);
  billingLimiter = new MemoryRateLimiter(10, 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────
// Helper: Get client IP from request headers
// ─────────────────────────────────────────────────────────────────────

export function getClientIp(headersList: Headers): string {
  return headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
    || headersList.get('x-real-ip')
    || 'anonymous';
}

// ─────────────────────────────────────────────────────────────────────
// Helper: Standard 429 JSON response
// ─────────────────────────────────────────────────────────────────────

export function rateLimitResponse(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return {
    status: 429,
    body: { error: "Rate limit exceeded. Please try again later." },
    headers: {
      'Retry-After': retryAfter.toString(),
      'X-RateLimit-Reset': reset.toString(),
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// Helper: Dynamic Rate Limiter based on Merchant Plan
// ─────────────────────────────────────────────────────────────────────

const PLAN_LIMITS: Record<string, number> = {
  free: 60,
  pro: 300,
  premium: 1000,
  business: 3000,
};

const planLimitersCache = new Map<string, SafeRateLimiter | MemoryRateLimiter>();

export async function checkPlanRateLimit(merchantId: string, planSlug: string = 'free') {
  const maxLimit = PLAN_LIMITS[planSlug] || 60;
  
  let limiter = planLimitersCache.get(planSlug);
  if (!limiter) {
    if (hasRedis && redis) {
      limiter = new SafeRateLimiter(
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(maxLimit, "1 m"),
          prefix: `rl:plan:${planSlug}`,
        }),
        new MemoryRateLimiter(maxLimit, 60 * 1000)
      );
    } else {
      limiter = new MemoryRateLimiter(maxLimit, 60 * 1000);
    }
    planLimitersCache.set(planSlug, limiter);
  }

  return await limiter.limit(merchantId);
}

export { 
  authLimiter, 
  apiLimiter, 
  paymentsLimiter, 
  paymentLinksLimiter, 
  withdrawalsLimiter, 
  webhooksTestLimiter,
  mobileLimiter,
  uploadLimiter,
  aiChatLimiter,
  billingLimiter,
  hasRedis 
};

