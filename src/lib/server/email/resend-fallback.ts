import 'server-only';
import { getRuntimeEnvironmentValue as env } from '@/lib/server/runtime-env';

export async function sendResendFallback(input: {
  to: string; subject: string; html: string; text: string; replyTo?: string;
  senderName?: string; idempotencyKey?: string;
}): Promise<{ success: boolean; error?: string }> {
  const key = env('RESEND_API_KEY');
  if (!key) return { success: false, error: 'Service e-mail de secours non configuré.' };
  const configured = env('RESEND_FROM_EMAIL') || 'Kobara <noreply@kobara.app>';
  const address = configured.match(/<([^<>]+)>\s*$/)?.[1] || configured.trim();
  if (/[\r\n]/.test(configured) || !/^[^\s<>@]+@[^\s<>@]+$/.test(address)) {
    return { success: false, error: 'Expéditeur du service de secours invalide.' };
  }
  const name = input.senderName?.replace(/[\r\n"\\<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,120);
  const from = name ? `"${name}" <${address}>` : configured;
  const deliveryKey = input.idempotencyKey || `kobara-email-${crypto.randomUUID()}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': deliveryKey },
        body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html, text: input.text,
          ...(input.replyTo ? { reply_to: input.replyTo } : {}) }),
      });
      if (response.ok) return { success: true };
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        const retry = Number(response.headers.get('retry-after'));
        const delay = Math.min(30_000, Number.isFinite(retry) && retry > 0 ? retry * 1000 : 1000 * 2 ** (attempt - 1));
        await response.body?.cancel();
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      await response.body?.cancel();
      return { success: false, error: `Service e-mail de secours indisponible (${response.status}).` };
    } catch {
      if (attempt === 4) return { success: false, error: 'Service e-mail de secours indisponible.' };
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** (attempt - 1)));
    }
  }
  return { success: false, error: 'Service e-mail de secours indisponible.' };
}
