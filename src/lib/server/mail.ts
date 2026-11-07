import { isReviewAccount, isReviewEmail } from '@/lib/review-account';
import { escapeEmailHtml, renderKobaraEmail } from './email/template';
import type { EmailPresentation } from './email/template';
// Cloudflare handles transactional mail; SES SMTP handles marketing. Resend is backup only.

type EmailTemplateProps = {
  subject: string;
  greeting?: string;
  paragraphs: string[];
  cta?: { text: string; url: string };
  secondaryInfo?: { label: string; value: string }[];
  alertType?: 'info' | 'warning' | 'critical';
};

function renderEmailTemplate({ subject, greeting, paragraphs, cta, secondaryInfo, alertType }: EmailTemplateProps) {
  const escape = escapeEmailHtml;
  return `<h1>${escape(subject)}</h1>${greeting ? `<p>${escape(greeting)}</p>` : ''}
    ${paragraphs.map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}
    ${secondaryInfo?.length ? `<table>${secondaryInfo.map(info => `<tr><td>${escape(info.label)}</td><td><strong>${escape(info.value)}</strong></td></tr>`).join('')}</table>` : ''}
    ${cta ? `<p style="text-align:center"><a href="${escape(cta.url)}" style="display:inline-block;background:#ff7a1a">${escape(cta.text)}</a></p><p>${escape(cta.url)}</p>` : ''}
    ${alertType === 'critical' ? '<blockquote>Si vous ne reconnaissez pas cette activité, contactez immédiatement le support Kobara.</blockquote>' : ''}`;
}

// Per-isolate pacing; durable campaign quotas and recipient leases remain upstream.

let lastEmailSendTime = 0;
const MIN_SEND_INTERVAL_MS = 150;
let sendQueuePromise: Promise<void> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scheduleEmailSend<T>(fn: () => Promise<T>): Promise<T> {
  const resultPromise = sendQueuePromise.then(async () => {
    const now = Date.now();
    const elapsed = now - lastEmailSendTime;
    if (elapsed < MIN_SEND_INTERVAL_MS) {
      await sleep(MIN_SEND_INTERVAL_MS - elapsed);
    }
    lastEmailSendTime = Date.now();
    return fn();
  });

  // Maintient la file active même si un envoi échoue
  sendQueuePromise = resultPromise.then(() => {}, () => {});

  return resultPromise;
}

export function emailSenderWithName(configuredSender: string, senderName?: string): string {
  if (!senderName) return configuredSender;
  const address = configuredSender.match(/<([^<>]+)>\s*$/)?.[1] || configuredSender.trim();
  if (!/^[^\s<>@]+@[^\s<>@]+$/.test(address)) throw new Error('Invalid configured email sender');
  const name = senderName.replace(/[\r\n"\\<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'Kobara';
  return `"${name}" <${address}>`;
}

async function sendEmailCore(
  { to, subject, html, text, replyTo, idempotencyKey, senderName, kind = 'transactional', presentation }: { to: string; subject: string; html: string; text: string; replyTo?: string; idempotencyKey?: string; senderName?: string; kind?: 'transactional' | 'marketing'; presentation?: EmailPresentation },
): Promise<{ success: boolean; error?: string }> {
  if (isReviewEmail(to)) return { success: true };
  // Suppress interactive mail (invitations, support, settings) initiated by reviewers.
  let currentUserId: string | undefined;
  try {
    const { auth } = await import('@/auth');
    currentUserId = (await auth())?.user?.id;
  } catch {
    // Scheduled jobs have no request session; their source-specific guards apply.
  }
  if (currentUserId) {
    const { createAdminClient } = await import('@/utils/supabase/admin');
    const { data: merchants, error } = await createAdminClient().from('merchants').select('*').eq('user_id', currentUserId);
    if (error) return { success: false, error: 'Vérification du contexte e-mail indisponible' };
    if (merchants?.some(isReviewAccount)) return { success: true };
  }
  html = renderKobaraEmail({ subject, text, html, kind, presentation });
  if (kind === 'transactional') {
    const { tryCloudflareEmail } = await import('./email/cloudflare');
    const result = await tryCloudflareEmail({ to, subject, html, text, replyTo, senderName });
    if (result.status === 'accepted') return { success: true };
    if (result.status === 'failed') return { success: false, error: result.error };
  } else {
    const { trySesSmtpEmail } = await import('./email/ses-smtp');
    const result = await scheduleEmailSend(() => trySesSmtpEmail({ to, subject, html, text, replyTo, senderName }));
    if (result.status === 'accepted') return { success: true };
    if (result.status === 'failed') return { success: false, error: result.error };
  }
  const { sendResendFallback } = await import('./email/resend-fallback');
  return scheduleEmailSend(() => sendResendFallback({ to, subject, html, text, replyTo, senderName, idempotencyKey }));
}

// ------------------------------------------------------------------
// TEMPLATES PRÊTS À L'EMPLOI
// ------------------------------------------------------------------

export async function sendWelcomeEmail({ to, verificationLink }: { to: string; verificationLink: string }) {
  const subject = "Confirmez votre adresse e-mail Kobara";
  const text = `Bonjour,\n\nBienvenue sur Kobara. Confirmez votre adresse e-mail pour poursuivre la configuration de votre compte : ${verificationLink}\n\nCe lien est valable pendant 24 heures. La réception de paiements réels reste soumise à la validation de votre identité et de votre activité.`;
  
  const html = renderEmailTemplate({
    subject,
    greeting: "Bienvenue sur Kobara !",
    paragraphs: [
      "Merci d'avoir choisi Kobara comme infrastructure de paiement pour votre entreprise.",
      "Confirmez votre adresse e-mail pour poursuivre la configuration de votre compte marchand.",
      "La réception de paiements réels reste soumise à la validation de votre identité et de votre activité."
    ],
    cta: {
      text: "Confirmer mon adresse e-mail",
      url: verificationLink
    },
    secondaryInfo: [
      { label: "Validité", value: "Ce lien expire dans 24 heures." }
    ]
  });

  return sendEmailCore({ to, subject, html, text, presentation: { type: 'message', purpose: 'security', context: 'Bienvenue sur Kobara' } });
}

export async function sendPasswordResetEmail({ to, resetLink }: { to: string; resetLink: string }) {
  const subject = "Réinitialisation de votre mot de passe Kobara";
  const text = `Une demande de réinitialisation du mot de passe de votre compte Kobara a été reçue. Choisissez un nouveau mot de passe : ${resetLink}\n\nCe lien expire dans 1 heure. Si vous n’avez pas fait cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.`;
  
  const html = renderEmailTemplate({
    subject,
    greeting: "Bonjour,",
    paragraphs: [
      "Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Kobara.",
      "Si vous êtes à l'origine de cette demande, veuillez cliquer sur le bouton ci-dessous pour créer un nouveau mot de passe."
    ],
    cta: {
      text: "Réinitialiser mon mot de passe",
      url: resetLink
    },
    secondaryInfo: [
      { label: "Validité", value: "Ce lien expire dans 1 heure." },
      { label: "Sécurité", value: "Si vous n'avez pas fait cette demande, ignorez cet e-mail." }
    ],
    alertType: 'warning'
  });

  return sendEmailCore({ to, subject, html, text });
}

export async function sendSecurityAlertEmail({ to, title, message, ipAddress, time }: { to: string; title: string; message: string; ipAddress?: string; time?: string }) {
  const subject = `Alerte de sécurité : ${title}`;
  const details = [
    ...(ipAddress ? [{ label: 'Adresse IP', value: ipAddress }] : []),
    ...(time ? [{ label: 'Date et heure', value: time }] : []),
  ];
  const text = [message, ...details.map(detail => `${detail.label} : ${detail.value}`), 'Si vous ne reconnaissez pas cette activité, contactez immédiatement le support Kobara.'].join('\n\n');
  
  const html = renderEmailTemplate({
    subject: title,
    paragraphs: [message],
    secondaryInfo: details,
    alertType: 'critical'
  });

  return sendEmailCore({ to, subject, html, text });
}

export async function sendTeamInviteEmail({ to, businessName, inviteLink, role }: { to: string; businessName: string; inviteLink: string; role: string }) {
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Développeur';
  const subject = `Invitation à rejoindre l'équipe de ${businessName} sur Kobara`;
  const text = `Bonjour,\n\nVous avez été invité à rejoindre l'équipe de ${businessName} en tant que ${roleLabel}.\n\nCliquez sur ce lien pour accepter l'invitation :\n${inviteLink}\n\nSi vous n'avez pas de compte Kobara, vous pourrez créer votre mot de passe directement lors de l'acceptation.`;

  const html = renderEmailTemplate({
    subject,
    greeting: "Invitation d'équipe Kobara",
    paragraphs: [
      `L'entreprise ${businessName} vous a invité(e) à rejoindre son équipe sur Kobara en tant que ${roleLabel}.`,
      "Votre accès sera limité aux autorisations du rôle qui vous est attribué. Vérifiez le nom de l’entreprise et le rôle ci-dessous avant d’accepter cette invitation."
    ],
    cta: {
      text: "Accepter l'invitation",
      url: inviteLink
    },
    secondaryInfo: [
      { label: "Entreprise", value: businessName },
      { label: "Rôle assigné", value: roleLabel }
    ]
  });

  return sendEmailCore({ to, subject, html, text });
}

// Fonction générique (pour la rétrocompatibilité)
export async function sendEmail({ to, subject, html, text, replyTo, idempotencyKey, senderName, kind, presentation }: { to: string; subject: string; html?: string; text: string; replyTo?: string; idempotencyKey?: string; senderName?: string; kind?: 'transactional' | 'marketing'; presentation?: EmailPresentation }) {
  const generatedHtml = html || '';
  return sendEmailCore({ to, subject, html: generatedHtml, text, replyTo, idempotencyKey, senderName, kind, presentation });
}

export async function isEmailDeliveryConfigured(kind: 'transactional' | 'marketing') {
  if (kind === 'marketing') {
    const { hasSesSmtpConfiguration } = await import('./email/ses-smtp');
    return hasSesSmtpConfiguration();
  }
  const { getRuntimeEnvironmentValue } = await import('./runtime-env');
  const { hasCloudflareEmailBinding } = await import('./email/cloudflare');
  return hasCloudflareEmailBinding() || Boolean(getRuntimeEnvironmentValue('RESEND_API_KEY'));
}

export async function sendBulkEmail({
  recipients,
  subject,
  text,
  html,
  idempotencyKey,
  kind = 'marketing',
}: {
  recipients: string[];
  subject: string;
  text: string;
  html?: string;
  idempotencyKey: string;
  kind?: 'transactional' | 'marketing';
}) {
  const emails = [...new Set(recipients.map((email) => email.trim().toLowerCase()).filter(Boolean))];
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (let index = 0; index < emails.length; index++) {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${idempotencyKey}\0${emails[index]}`));
      const deliveryKey = `bulk-email-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
      const result = await sendEmailCore({ to: emails[index], subject, text, html: html || '', kind,
        idempotencyKey: deliveryKey });
      if (result.success) sent++;
      else { failed++; errors.push(result.error || 'Envoi e-mail échoué.'); }
    } catch { failed++; errors.push('Envoi e-mail indisponible.'); }
  }

  return { sent, failed, errors };
}
