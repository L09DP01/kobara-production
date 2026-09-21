import 'server-only';

import { sendEmail } from '@/lib/server/mail';

function invitationHtml(title: string, body: string, cta: string, url: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#172033"><h1 style="color:#ff4a1c">Kobara</h1><h2>${title}</h2><p style="line-height:1.6">${body}</p><p><a href="${url}" style="display:inline-block;background:#ff4a1c;color:white;padding:13px 20px;border-radius:6px;text-decoration:none;font-weight:700">${cta}</a></p><p style="color:#64748b;font-size:13px">Ce lien est personnel et expire automatiquement.</p></div>`;
}

export function sendDeveloperMerchantInvitation(input: { to: string; developerName: string; url: string }) {
  const subject = `${input.developerName} vous invite à connecter votre entreprise à Kobara`;
  return sendEmail({
    to: input.to,
    subject,
    text: `${subject}. Acceptez l'invitation: ${input.url}`,
    html: invitationHtml(subject, 'Acceptez cette invitation pour autoriser le développeur à configurer vos paiements Kobara. Les retraits restent désactivés tant que vous ne les autorisez pas explicitement.', "Accepter l'invitation", input.url),
  });
}

export function sendMerchantReferralInvitation(input: { to: string; merchantName: string; url: string }) {
  const subject = `${input.merchantName} vous invite à rejoindre Kobara`;
  return sendEmail({
    to: input.to,
    subject,
    text: `${subject}. Créez ou connectez votre compte: ${input.url}`,
    html: invitationHtml(subject, 'Créez votre compte marchand et acceptez les paiements avec Kobara.', 'Rejoindre Kobara', input.url),
  });
}

export function sendPartnerActivation(input: { to: string; program: 'Developer' | 'Ambassadeur'; url: string }) {
  const subject = `Votre compte Kobara ${input.program} est activé`;
  return sendEmail({
    to: input.to,
    subject,
    text: `${subject}. Définissez votre mot de passe: ${input.url}`,
    html: invitationHtml(subject, 'Votre accès a été approuvé. Définissez votre mot de passe pour ouvrir votre espace partenaire.', 'Activer mon accès', input.url),
  });
}
