import { createAdminClient } from "@/utils/supabase/admin";
import crypto from "crypto";
import { safeRedis } from "../redis";

export type IdempotencyResult = 
  | { status: 'proceed'; keyId: string }
  | { status: 'cached'; response: any; statusCode: number }
  | { status: 'conflict'; error: string };

function hashBody(body: any): string {
  const normalized = typeof body === 'string' ? body : JSON.stringify(body || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export async function checkIdempotency(
  merchantId: string,
  key: string,
  endpoint: string,
  body: any
): Promise<IdempotencyResult> {
  if (!key || key.trim() === '') {
    throw new Error('Idempotency key is required');
  }

  const supabase = createAdminClient();
  const requestHash = hashBody(body);
  const redisLockKey = `idempotency_lock:${merchantId}:${endpoint}:${key}`;

  // 1. Fast Lock with Redis (5 minutes = 300s)
  const lockAcquired = await safeRedis(async (redis) => {
    return await redis.set(redisLockKey, "locked", { nx: true, ex: 300 });
  }, null);

  // If we couldn't get the Redis lock (or Redis failed), we fall back to Postgres
  if (lockAcquired !== "OK") {
    // Lock is held or already processed. Check Postgres source of truth.
    const { data: existingRecord } = await supabase
      .from('idempotency_keys')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('key', key)
      .eq('endpoint', endpoint)
      .single();

    if (existingRecord) {
      if (existingRecord.status === 'completed') {
        if (existingRecord.request_hash !== requestHash) {
          return { status: 'conflict', error: 'Idempotency key already used for a different request' };
        }
        return { 
          status: 'cached', 
          response: existingRecord.response_json, 
          statusCode: existingRecord.status_code || 200 
        };
      }

      if (existingRecord.status === 'pending') {
        return { status: 'conflict', error: 'Request is already processing' };
      }

      if (existingRecord.status === 'failed') {
        return { status: 'conflict', error: 'Previous request failed. Please use a new idempotency key.' };
      }
    }
    // If it doesn't exist in Postgres but Redis lock failed, it might be a race condition in Redis or Redis error.
    // We will attempt to insert in Postgres anyway.
  }

  // 2. Source of Truth: PostgreSQL
  const { data: newRecord, error: insertError } = await supabase
    .from('idempotency_keys')
    .insert({
      merchant_id: merchantId,
      key: key,
      endpoint: endpoint,
      request_hash: requestHash,
      status: 'pending',
      locked_until: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    })
    .select('id')
    .single();

  if (insertError) {
    // 23505 is PostgreSQL unique constraint violation code
    if (insertError.code === '23505') {
      const { data: existingRecord } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('merchant_id', merchantId)
        .eq('key', key)
        .eq('endpoint', endpoint)
        .single();

      if (!existingRecord) {
        return { status: 'conflict', error: 'Concurrent request conflict' };
      }
      if (existingRecord.status === 'completed') {
        if (existingRecord.request_hash !== requestHash) return { status: 'conflict', error: 'Idempotency key already used for a different request' };
        return { status: 'cached', response: existingRecord.response_json, statusCode: existingRecord.status_code || 200 };
      }
      if (existingRecord.status === 'pending') return { status: 'conflict', error: 'Request is already processing' };
      if (existingRecord.status === 'failed') return { status: 'conflict', error: 'Previous request failed. Please use a new idempotency key.' };
    }
    throw insertError;
  }

  return { status: 'proceed', keyId: newRecord.id };
}

export async function saveIdempotencyResponse(
  keyId: string,
  responseJson: any,
  statusCode: number
) {
  const supabase = createAdminClient();
  await supabase
    .from('idempotency_keys')
    .update({
      status: 'completed',
      response_json: responseJson,
      status_code: statusCode
    })
    .eq('id', keyId);
}

export async function markIdempotencyFailed(keyId: string) {
  const supabase = createAdminClient();
  await supabase
    .from('idempotency_keys')
    .update({
      status: 'failed'
    })
    .eq('id', keyId);
}
