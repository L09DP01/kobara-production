import 'server-only';
import nodemailer from 'nodemailer';
import { getRuntimeEnvironmentValue as env } from '@/lib/server/runtime-env';

type Input = { to: string; subject: string; html: string; text: string; senderName?: string; replyTo?: string };
type Result = { status: 'accepted' | 'fallback' | 'failed'; error?: string };

export function hasSesSmtpConfiguration() {
  return Boolean(env('SES_SMTP_HOST') && env('SES_SMTP_USER') && env('SES_SMTP_PASSWORD') && env('SES_SMTP_FROM'));
}

export async function trySesSmtpEmail(input: Input): Promise<Result> {
  if (!hasSesSmtpConfiguration()) return { status: 'failed', error: 'Amazon SES SMTP doit être configuré avant les envois marketing.' };
  const host = env('SES_SMTP_HOST');
  const port = Number(env('SES_SMTP_PORT') || '465');
  const classicSes = /^email-smtp\.[a-z0-9-]+\.amazonaws\.com(?:\.cn)?$/.test(host);
  const mailManager = /^[a-z0-9-]+(?:\.[a-z0-9-]+){0,3}\.mail-manager-smtp\.amazonaws\.com(?:\.cn)?$/.test(host);
  // Do not disclose SES credentials to an arbitrary SMTP host or plaintext port.
  if ((!classicSes && !mailManager)
    || (mailManager ? port !== 587 : ![465, 2465, 587, 2587].includes(port))) {
    return { status: 'failed', error: 'Configuration SMTP Amazon SES invalide.' };
  }
  const configured = env('SES_SMTP_FROM');
  const match = configured.match(/^(.*?)\s*<([^<>]+)>$/);
  const address = (match?.[2] || configured).trim();
  if (/[\r\n]/.test(configured) || !/^[^\s<>@]+@[^\s<>@]+$/.test(address)) {
    return { status: 'failed', error: 'Adresse expéditeur Amazon SES invalide.' };
  }
  const name = (input.senderName || match?.[1] || 'Kobara').replace(/[\r\n"\\<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const transport = nodemailer.createTransport({
    host, port, secure: port === 465 || port === 2465,
    requireTLS: true,
    auth: { user: env('SES_SMTP_USER'), pass: env('SES_SMTP_PASSWORD') },
    tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, servername: host },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false,
  });
  try {
    const result = await transport.sendMail({
      from: { name, address }, to: input.to, subject: input.subject,
      html: input.html, text: input.text, ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    });
    if (result.accepted?.length && result.messageId) return { status: 'accepted' };
    return { status: 'failed', error: 'Résultat SMTP incertain. Vérifiez les journaux SES avant de renvoyer.' };
  } catch (error) {
    const details = (error && typeof error === 'object' ? error : {}) as { code?: string; command?: string; responseCode?: number };
    const { code = '', command = '', responseCode = 0 } = details;
    console.warn('[Email] SES SMTP send failed', { code, command, responseCode });
    // Explicit temporary rejection or a failure before message submission is safe
    // to hand to the backup. Never bypass a permanent recipient/policy rejection.
    if ((responseCode >= 400 && responseCode < 500) || code === 'EAUTH' || code === 'EDNS'
      || (/^(?:CONN|EHLO|HELO|STARTTLS|AUTH(?: .*)?|MAIL FROM)$/.test(command) && responseCode < 500)) {
      return { status: 'fallback' };
    }
    return { status: 'failed', error: responseCode >= 500
      ? 'Envoi refusé par Amazon SES. Vérifiez le destinataire et les règles de livraison.'
      : 'Résultat SMTP incertain. Vérifiez les journaux SES avant de renvoyer.' };
  } finally {
    // Cleanup must not turn a confirmed acceptance into a retryable failure.
    try { transport.close(); } catch { /* No cross-request pooled socket to retain. */ }
  }
}
