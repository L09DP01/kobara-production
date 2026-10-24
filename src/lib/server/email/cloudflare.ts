import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getRuntimeEnvironmentValue } from '@/lib/server/runtime-env';

type EmailInput = { to: string; subject: string; html: string; text: string; replyTo?: string; senderName?: string };
type DeliveryResult = { status: 'accepted' | 'fallback' | 'failed'; error?: string };

const FALLBACK_ERRORS = new Set([
  'E_SENDER_NOT_VERIFIED', 'E_SENDER_DOMAIN_NOT_AVAILABLE',
  'E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED', 'E_DELIVERY_FAILED',
]);

function senderAddress(configured: string, overrideName?: string) {
  if (/[\r\n]/.test(configured)) throw new Error('Invalid email sender');
  const match = configured.trim().match(/^(.*?)\s*<([^<>]+)>$/);
  const email = (match?.[2] || configured).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+$/.test(email)) throw new Error('Invalid email sender');
  const name = (overrideName || match?.[1] || '').replace(/[\r\n"\\<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,120);
  return name ? { email, name } : email;
}

export async function tryCloudflareEmail(input: EmailInput): Promise<DeliveryResult> {
  if (getRuntimeEnvironmentValue('EMAIL_PRIMARY_PROVIDER') === 'resend') return { status: 'fallback' };
  let binding: CloudflareEnv['EMAIL'] | undefined;
  try { binding = getCloudflareContext().env.EMAIL; } catch { /* Node.js has no Workers binding. */ }
  if (!binding || typeof binding.send !== 'function') return { status: 'fallback' };

  let from;
  try {
    from = senderAddress(getRuntimeEnvironmentValue('CLOUDFLARE_FROM_EMAIL')
      || getRuntimeEnvironmentValue('RESEND_FROM_EMAIL') || 'Kobara <noreply@kobara.app>', input.senderName);
  } catch { return { status: 'fallback' }; }

  try {
    const response = await binding.send({
      from, to: input.to, subject: input.subject, html: input.html, text: input.text,
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    // Acceptance is not inbox delivery. Never resend an accepted or ambiguous email.
    if (typeof response?.messageId === 'string' && response.messageId) return { status: 'accepted' };
    return { status: 'failed', error: 'Résultat d’envoi Cloudflare incertain. Vérifiez le journal avant de renvoyer.' };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    console.warn('[Email] Cloudflare send refused or uncertain', { code: code || 'UNKNOWN' });
    if (FALLBACK_ERRORS.has(code)) return { status: 'fallback' };
    // Suppression, binding recipient restrictions and account suspensions must
    // not be bypassed through another provider. Unknown outcomes may be accepted.
    return { status: 'failed', error: code.startsWith('E_')
      ? 'Envoi e-mail refusé par Cloudflare. Vérifiez les règles de livraison.'
      : 'Résultat d’envoi Cloudflare incertain. Vérifiez le journal avant de renvoyer.' };
  }
}
