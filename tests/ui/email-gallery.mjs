// Local preview only: fictitious data, no provider, authentication or database calls.
import http from 'node:http';
import { renderKobaraEmail, escapeEmailHtml } from '../../src/lib/server/email/template.ts';

export const subjects = [
  'Activez votre compte Kobara', 'Réinitialisation de votre mot de passe Kobara',
  'Code de vérification de connexion', 'Nouvelle connexion autorisée', 'Nouvelle connexion à votre compte Kobara',
  'Mot de passe modifié', 'Clé API révoquée', 'Double authentification activée', 'Passkey ajoutée',
  'Code de vérification de retrait', 'Code de vérification de transfert B2B', 'Compte Telegram associé',
  'Code de vérification Support Kobara', 'Tentative d’utilisation de votre identité', 'Compte bloqué après contrôle d’identité',
  'Vérification de sécurité requise', 'Paiement échoué', 'Paiement confirmé - Boutique Exemple',
  'Finalisez le paiement : Formation Exemple - commande #1042', 'Paiement reçu - 4 500 HTG',
  'Demande de retrait reçue', 'Retrait approuvé', 'Demande de retrait refusée', 'Retrait complété', 'Retrait échoué',
  'Transfert B2B envoyé', 'Transfert B2B reçu', '[APPROBATION REQUISE] Retrait NatCash', '[NOUVEAU RETRAIT] Retrait traité',
  'Vérification d’identité validée', 'Vérification en cours d’examen', 'Finalisez la vérification de votre compte Kobara',
  'Recevez votre premier paiement avec Kobara', 'Continuer la vérification Kobara sur téléphone',
  '[KYC EN ATTENTE] Revue manuelle requise', '[KYC VALIDÉ IA] Vérification automatique réussie',
  '[Kobara Compliance] Alerte suspension KYC', 'Compte Kobara suspendu', 'Compte Kobara réactivé',
  '[KB-EXEMPLE] Confirmation de réception', '[KB-EXEMPLE] Demande reçue par Kobara',
  '[KB-EXEMPLE] Assistance Kobara', '[KB-EXEMPLE] Réponse Kobara', '[KB-EXEMPLE] Suivi humain requis',
  '[KB-EXEMPLE] Client WhatsApp en attente', 'Invitation à rejoindre l’équipe Boutique Exemple',
  'Studio Exemple vous invite à connecter votre entreprise à Kobara', 'Boutique Exemple vous invite à rejoindre Kobara',
  'Votre compte Kobara Developer est activé', 'Votre compte Kobara Ambassadeur est activé',
  'Accès administrateur Kobara', 'Code de vérification Super Admin',
  'Kobara - Information importante pour votre compte', 'Kobara - Une annonce de l’équipe Kobara',
  'Vos liens de paiement sont prêts', 'Une seule intégration pour accepter vos paiements', 'Votre compte Kobara vous attend',
];

function sample(index) {
  const subject = subjects[index];
  if (!subject) return null;
  const kind = index >= 53 || index === 47 ? 'marketing' : 'transactional';
  if (/^Code/.test(subject)) return renderKobaraEmail({ subject, kind, text: 'Bonjour,\n\nSaisissez ce code pour confirmer votre demande.\n\n123456\n\nCe code est fictif et expire dans 10 minutes.\nNe le partagez avec personne.' });
  const payment = /paiement|retrait|transfert|commande/i.test(subject);
  const title = payment && index === 18 ? 'Finalisez votre paiement' : subject;
  return renderKobaraEmail({ subject, kind, text: '', html: `<h1>${escapeEmailHtml(title)}</h1><p>Bonjour Camille,</p><p>${payment ? 'Voici le récapitulatif de votre opération avec Boutique Exemple.' : 'Retrouvez les informations concernant votre compte Kobara.'}</p>${payment ? '<p><strong>4 500 HTG</strong></p>' : ''}<table><tr><td>Entreprise</td><td><strong>Boutique Exemple</strong></td></tr>${index === 18 ? '<tr><td>Produit</td><td><strong>Formation Exemple</strong></td></tr><tr><td>Commande</td><td>#1042</td></tr>' : '<tr><td>Référence</td><td>DEMO-2026-001</td></tr>'}<tr><td>Date</td><td>24 oct. 2026</td></tr></table><p style="text-align:center"><a href="https://dashboard.kobara.app" style="display:inline-block;background:orange">${index === 18 ? 'Finaliser le paiement' : 'Voir les détails'}</a></p>${kind === 'marketing' ? '<p>Vous recevez les actualités Kobara. <a href="https://example.com/unsubscribe?token=demo">Se désabonner</a></p>' : ''}` });
}

const port = Number(process.env.EMAIL_PREVIEW_PORT || 3041);
http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const match = url.pathname.match(/^\/email\/(\d+)$/);
  const html = match ? sample(Number(match[1]) - 1) : `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>E-mails Kobara : aperçus</title></head><body style="margin:24px;font-family:Arial;background:#eeece8;color:#161923"><h1>E-mails Kobara</h1><p>Aperçus locaux avec données fictives. Aucun e-mail n’est envoyé.</p><ol>${subjects.map((subject, index) => `<li style="margin:14px 0"><a style="color:#a74300" href="/email/${index + 1}">${escapeEmailHtml(subject)}</a></li>`).join('')}</ol></body></html>`;
  response.writeHead(html ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(html || 'Not found');
}).listen(port, '127.0.0.1', () => console.log(`Email preview ready: http://127.0.0.1:${port}`));
