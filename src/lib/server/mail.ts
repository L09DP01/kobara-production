// Module d'envoi d'e-mails pour Kobara utilisant Resend
// Fonctionne de manière native sur les environnements Edge et Serverless comme Vercel

type EmailTemplateProps = {
  subject: string;
  greeting?: string;
  paragraphs: string[];
  cta?: { text: string; url: string };
  secondaryInfo?: { label: string; value: string }[];
  alertType?: 'info' | 'warning' | 'critical';
};

function renderEmailTemplate({ subject, greeting, paragraphs, cta, secondaryInfo, alertType }: EmailTemplateProps) {
  let headerBg = '#F9FAFB';
  let headerColor = '#E53E3E'; // Rouge Kobara
  
  if (alertType === 'warning') {
    headerBg = '#FFFBEB';
    headerColor = '#D97706';
  } else if (alertType === 'critical') {
    headerBg = '#FEF2F2';
    headerColor = '#DC2626';
  }

  const pStyle = "color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;";

  const greetingHtml = greeting ? `<p style="${pStyle} font-weight: 600; color: #111827;">${greeting}</p>` : '';
  const paragraphsHtml = paragraphs.map(p => `<p style="${pStyle}">${p}</p>`).join('');
  
  const ctaHtml = cta ? `
    <div style="text-align: center; margin: 32px 0;">
      <a href="${cta.url}" style="background-color: ${headerColor}; color: #ffffff; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 8px; display: inline-block; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ${cta.text}
      </a>
    </div>
  ` : '';

  const secondaryHtml = secondaryInfo && secondaryInfo.length > 0 ? `
    <div style="background-color: #F3F4F6; border-radius: 8px; padding: 16px; margin-top: 32px;">
      ${secondaryInfo.map(info => `
        <div style="margin-bottom: 8px; font-size: 14px;">
          <strong style="color: #374151;">${info.label}:</strong> <span style="color: #6B7280;">${info.value}</span>
        </div>
      `).join('')}
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F3F4F6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    
    <!-- Card -->
    <div style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #E5E7EB;">
      
      <!-- Header -->
      <div style="background-color: ${headerBg}; padding: 32px 40px; text-align: center; border-bottom: 1px solid #E5E7EB;">
        <h1 style="color: ${headerColor}; font-size: 28px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Kobara</h1>
      </div>

      <!-- Body -->
      <div style="padding: 40px;">
        <h2 style="color: #111827; font-size: 22px; font-weight: 700; margin-top: 0; margin-bottom: 24px;">${subject}</h2>
        
        ${greetingHtml}
        ${paragraphsHtml}
        ${ctaHtml}
        ${secondaryHtml}
        
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px;">
      <p style="color: #9CA3AF; font-size: 14px; margin: 0;">© ${new Date().getFullYear()} Kobara App. Tous droits réservés.</p>
      <p style="color: #9CA3AF; font-size: 14px; margin: 8px 0 0 0;">Infrastructure de paiement pour Haïti.</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Rate limiting & Queue pour l'API Resend
// La limite standard Resend est de 10 requêtes / seconde.
// Nous appliquons un espacement minimum de 150ms (~6.6 emails/s max)
// et un système de retry automatique avec backoff exponentiel sur HTTP 429.

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

async function sendEmailCore(
  { to, subject, html, text }: { to: string; subject: string; html: string; text: string },
): Promise<{ success: boolean; error?: string }> {
  const separator = "─".repeat(56);
  console.log(`
┌${separator}┐
│ 📧 [KOBARA EMAIL LOG]                                  │
│                                                        │
│ Destinataire : ${to.padEnd(39)} │
│ Sujet        : ${subject.padEnd(39)} │
└${separator}┘
  `);

  if (!process.env.RESEND_API_KEY) {
    console.log(`[INFO] Clé RESEND_API_KEY manquante. L'e-mail a été généré en mode développement.`);
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Service e-mail non configuré' };
    }
    return { success: true };
  }

  const payload = {
    from: process.env.RESEND_FROM_EMAIL || 'Kobara <noreply@kobara.app>',
    to: [to],
    subject: subject,
    html: html,
    text: text
  };

  const maxRetries = 4;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await scheduleEmailSend(() =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      );

      if (res.ok) {
        return { success: true };
      }

      const status = res.status;
      const providerMessage = await res.text();

      // Gestion spécifique du Rate Limit (429) et erreurs serveur temporaires (5xx)
      if (status === 429 || (status >= 500 && status < 600)) {
        if (attempt < maxRetries) {
          const retryAfterHeader = res.headers.get('retry-after');
          let delayMs = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300); // 1s, 2s, 4s + jitter

          if (retryAfterHeader) {
            const parsedSeconds = parseFloat(retryAfterHeader);
            if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
              delayMs = Math.ceil(parsedSeconds * 1000) + 150;
            }
          }

          console.warn(
            `⚠️ [RESEND RATE LIMIT ${status}] Limite atteinte pour ${to}. Tentative ${attempt}/${maxRetries} - Attente de ${delayMs}ms avant réessai...`
          );
          await sleep(delayMs);
          continue;
        }
      }

      console.error(`[RESEND ERROR] Échec de l'envoi à ${to} (${status}) :`, providerMessage);
      return { success: false, error: `Service e-mail indisponible (${status})` };
    } catch (error: any) {
      if (attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 300);
        console.warn(
          `⚠️ [RESEND NETWORK ERROR] Exception réseau pour ${to}. Tentative ${attempt}/${maxRetries} dans ${delayMs}ms... ${error.message}`
        );
        await sleep(delayMs);
        continue;
      }

      console.error(`[RESEND ERROR] Exception lors de l'envoi à ${to} :`, error);
      return { success: false, error: error instanceof Error ? error.message : "Erreur réseau du service e-mail" };
    }
  }

  return { success: false, error: "Trop de requêtes e-mail. Veuillez réessayer plus tard." };
}

// ------------------------------------------------------------------
// TEMPLATES PRÊTS À L'EMPLOI
// ------------------------------------------------------------------

export async function sendWelcomeEmail({ to, verificationLink }: { to: string; verificationLink: string }) {
  const subject = "Activez votre compte Kobara";
  const text = `Bonjour,\n\nMerci de vous être inscrit sur Kobara. Pour activer votre compte marchand et commencer à accepter des paiements MonCash, veuillez cliquer sur ce lien : ${verificationLink}\n\nCe lien est valide pendant 24 heures.`;
  
  const html = renderEmailTemplate({
    subject,
    greeting: "Bienvenue sur Kobara !",
    paragraphs: [
      "Merci d'avoir choisi Kobara comme infrastructure de paiement pour votre entreprise.",
      "Pour activer votre compte marchand et commencer à générer des liens de paiement MonCash, vous devez d'abord vérifier votre adresse e-mail."
    ],
    cta: {
      text: "Activer mon compte",
      url: verificationLink
    },
    secondaryInfo: [
      { label: "Validité", value: "Ce lien expire dans 24 heures." }
    ]
  });

  return sendEmailCore({ to, subject, html, text });
}

export async function sendPasswordResetEmail({ to, resetLink }: { to: string; resetLink: string }) {
  const subject = "Réinitialisation de votre mot de passe Kobara";
  const text = `Vous avez demandé la réinitialisation de votre mot de passe Kobara. Cliquez sur ce lien : ${resetLink}`;
  
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
  const subject = `Alerte de sécurité: ${title}`;
  const text = `Alerte Kobara: ${message}\nIP: ${ipAddress}\nHeure: ${time}`;
  
  const html = renderEmailTemplate({
    subject: title,
    paragraphs: [message],
    secondaryInfo: [
      { label: "Adresse IP", value: ipAddress || "Inconnue" },
      { label: "Date & Heure", value: time || new Date().toLocaleString() }
    ],
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
      `L'entreprise <strong>${businessName}</strong> vous a invité(e) à rejoindre son équipe sur Kobara en tant que <strong>${roleLabel}</strong>.`,
      "En acceptant cette invitation, vous aurez accès au tableau de bord, aux intégrations API et aux statistiques de l'entreprise en toute sécurité."
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
export async function sendEmail({ to, subject, html, text }: { to: string; subject: string; html?: string; text: string }) {
  const generatedHtml = html || renderEmailTemplate({
    subject,
    paragraphs: text.split('\n\n').filter(p => p.trim() !== '')
  });
  return sendEmailCore({ to, subject, html: generatedHtml, text });
}
