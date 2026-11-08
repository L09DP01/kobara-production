import { Redis } from '@upstash/redis';
import { getRuntimeEnvironmentValue as env } from '@/lib/server/runtime-env';
import { sendEmail } from '@/lib/server/mail';
import { handleKapsoHandoff } from '@/lib/server/whatsapp/kapso-handoff';

export async function POST(request: Request) {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return new Response('Alert storage unavailable', { status: 503 });
  const reader = request.body?.getReader();
  if (!reader) return new Response('Missing payload', { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); return new Response('Payload too large', { status: 413 }); }
      chunks.push(value);
    }
  } catch { return new Response('Invalid payload', { status: 400 }); }
  const raw = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { raw.set(chunk, offset); offset += chunk.byteLength; }
  const redis = new Redis({ url, token });
  return handleKapsoHandoff(raw, request.headers.get('x-webhook-signature'), {
    secret: env('KAPSO_HANDOFF_WEBHOOK_SECRET'),
    projectId: env('KAPSO_PROJECT_ID'),
    workflowId: env('KAPSO_SUPPORT_WORKFLOW_ID'),
    recipient: env('KAPSO_HANDOFF_ALERT_EMAIL'),
    store: {
      get: key => redis.get(key),
      set: (key, value, options) => options.nx
        ? redis.set(key, value, { nx: true, ex: options.ex })
        : redis.set(key, value, { ex: options.ex }),
    },
    send: message => sendEmail({ ...message, kind: 'transactional', presentation: {
      type: 'message', purpose: 'internal', heading: 'Un client WhatsApp attend un conseiller', context: 'Support WhatsApp',
    } }),
  });
}
