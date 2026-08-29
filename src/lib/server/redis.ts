import { Redis } from "@upstash/redis";

export const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

export const redis = hasRedis 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

/**
 * Exécute une opération Redis en toute sécurité.
 * Retourne fallbackValue si Redis n'est pas configuré ou s'il y a une erreur réseau,
 * afin d'éviter de faire crasher l'application.
 */
export async function safeRedis<T>(
  operation: (redisClient: Redis) => Promise<T>,
  fallbackValue: T
): Promise<T> {
  if (!redis) return fallbackValue;
  try {
    return await operation(redis);
  } catch (error) {
    console.warn("Redis operation failed, using fallback:", error);
    return fallbackValue;
  }
}
