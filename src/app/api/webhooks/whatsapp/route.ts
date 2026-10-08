import { after } from 'next/server';
import { processWhatsAppWebhook } from '@/lib/server/whatsapp/service';
import { verifyMetaSignature } from '@/lib/server/whatsapp/security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return Response.json({ error: 'Webhook verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return Response.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  after(async () => {
    try {
      await processWhatsAppWebhook(payload);
    } catch (error) {
      console.error('[WhatsAppWebhook] Processing failed:', error);
    }
  });
  return Response.json({ received: true });
}
