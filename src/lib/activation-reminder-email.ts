export type ActivationReminderKind = 'kyc' | 'first_payment';

export function activationReminderEmail(kind: ActivationReminderKind, name: string) {
  const subject = kind === 'kyc' ? 'Finalisez la vérification de votre compte Kobara' : 'Recevez votre premier paiement avec Kobara';
  const url = kind === 'kyc' ? 'https://dashboard.kobara.app/kyc' : 'https://dashboard.kobara.app/payment-links';
  const paragraphs = kind === 'kyc'
    ? ['Votre compte Kobara attend encore sa vérification. Connectez-vous pour compléter les étapes KYC restantes et préparer vos encaissements.', 'Si vous avez déjà envoyé vos documents, consultez le statut de votre dossier : inutile de les renvoyer sans demande de notre équipe.']
    : ['Votre compte est vérifié. Vous pouvez maintenant créer votre premier lien de paiement, le partager avec un client ou connecter votre site à Kobara.', 'Besoin d’aide pour démarrer ? Répondez à cet e-mail ou consultez notre centre d’aide : https://help.kobara.app.'];
  const cta = kind === 'kyc' ? 'Finaliser mon KYC' : 'Créer mon premier lien';
  const greeting = `Bonjour ${name || 'et bienvenue'},`;
  const footer = 'Vous recevez ce rappel pour vous accompagner dans l’activation de votre compte. Vous pouvez le désactiver dans Paramètres > Notifications : https://dashboard.kobara.app/settings.';
  const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  const text = [greeting, ...paragraphs, `${cta} : ${url}`, footer].join('\n\n');
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#10131d"><h1 style="font-size:22px">${escape(subject)}</h1><p>${escape(greeting)}</p>${paragraphs.map(p => `<p style="line-height:1.7">${escape(p)}</p>`).join('')}<p style="margin:28px 0"><a href="${url}" style="background:#f45d2c;color:white;padding:14px 20px;text-decoration:none;border-radius:6px">${escape(cta)}</a></p><p style="font-size:12px;color:#5c5e66;line-height:1.6">${escape(footer)}</p></div>`;
  return { subject, text, html };
}
