import { Redis } from "@upstash/redis"

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const riskRedis = {
  async incrementFailedLogins(merchantId: string) {
    const key = `risk:login_failures:${merchantId}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 3600) // 1 hour
    }
    return count
  },

  async isRateLimited(merchantId: string, action: string, limit: number, windowSec: number) {
    const key = `risk:ratelimit:${action}:${merchantId}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSec)
    }
    return count > limit
  },

  async setJobLock(jobName: string, ttlSeconds: number = 60) {
    const key = `risk:lock:${jobName}`
    const acquired = await redis.set(key, "locked", { nx: true, ex: ttlSeconds })
    return acquired !== null
  },

  async releaseJobLock(jobName: string) {
    await redis.del(`risk:lock:${jobName}`)
  },

  async cacheActiveRules(rules: any[], ttlSeconds: number = 300) {
    await redis.set("risk:active_ai_rules", JSON.stringify(rules), { ex: ttlSeconds })
  },

  async getCachedActiveRules() {
    return await redis.get("risk:active_ai_rules")
  },
  
  async checkDeduplication(alertId: string, ttlSeconds: number = 3600) {
    const key = `risk:dedup:${alertId}`
    const exists = await redis.set(key, "1", { nx: true, ex: ttlSeconds })
    return exists === null // true if already existed
  }
}
