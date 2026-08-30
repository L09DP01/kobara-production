import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

const MAX_WEBHOOK_AGE_SECONDS = 5 * 60;

export function verifyResendWebhook(rawBody: string, headers: Headers) {
  const messageId = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signatureHeader = headers.get('svix-signature');
  const configuredSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();

  if (!configuredSecret || !messageId || !timestamp || !signatureHeader) {
    return false;
  }

  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestampNumber) > MAX_WEBHOOK_AGE_SECONDS) {
    return false;
  }

  try {
    const secret = Buffer.from(configuredSecret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', secret)
      .update(`${messageId}.${timestamp}.${rawBody}`)
      .digest();

    return signatureHeader.split(' ').some((entry) => {
      const [version, encodedSignature] = entry.split(',', 2);
      if (version !== 'v1' || !encodedSignature) return false;
      const received = Buffer.from(encodedSignature, 'base64');
      return received.length === expected.length && timingSafeEqual(received, expected);
    });
  } catch {
    return false;
  }
}

export type ReceivedEmail = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  message_id?: string | null;
  headers?: Record<string, string>;
  attachments?: Array<{
    id: string;
    filename: string;
    content_type: string;
    size?: number;
  }>;
};

export async function retrieveReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY manquante');

  const response = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  );
  if (!response.ok) {
    throw new Error(`Impossible de récupérer l'e-mail entrant (${response.status})`);
  }
  return response.json();
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
