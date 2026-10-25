import test from 'node:test';
import assert from 'node:assert/strict';
import { renderKobaraEmail, emailAppearance } from '../src/lib/server/email/template.ts';

test('security emails keep the exact selectable OTP and expiry', () => {
  const html = renderKobaraEmail({ subject: 'Code de vérification de connexion', text: '482913\nExpire dans 10 minutes.' });
  assert.match(html, /<code[^>]*>482913<\/code>/);
  assert.match(html, /Expire dans 10 minutes/);
  assert.match(html, /SÉCURITÉ/);
  assert.match(html, /jamais votre mot de passe/);
  assert.match(html, /src="https:\/\/kobara.app\/logo2.png" alt="Kobara"/);
  assert.match(html, /src="https:\/\/kobara.app\/logo.png" alt="Kobara"/);
});
test('existing HTML keeps links, customer details and unsubscribe without old layout', () => {
  const html = renderKobaraEmail({ subject: 'Votre commande', text: '', kind: 'marketing', html: '<html><head><style>body{width:1200px}</style></head><body><div style="width:1200px"><h1>Exemple Boutique</h1><p>Produit &amp; référence #1042</p><a href="https://pay.example/order?token=demo&amp;ref=1042" style="background:orange">Payer</a><a href="https://example.com/unsubscribe?token=demo">Se désabonner</a></div></body></html>' });
  assert.match(html, /Exemple Boutique/);
  assert.match(html, /Produit &amp; référence #1042/);
  assert.match(html, /https:\/\/pay.example\/order\?token=demo&amp;ref=1042/);
  assert.match(html, /unsubscribe\?token=demo/);
  assert.doesNotMatch(html, /1200px/);
  assert.equal((html.match(/<html /g) || []).length, 1);
  assert.match(html, /ACTUALITÉS/);
});
test('untrusted content cannot inject markup, scripts or unsafe links', () => {
  const plain = renderKobaraEmail({ subject: '<img src=x onerror=alert(1)>', text: '<script>example</script>' });
  assert.doesNotMatch(plain, /<script>|onerror="/);
  assert.match(plain, /&lt;script&gt;/);
  const rich = renderKobaraEmail({ subject: 'Support', text: '', html: '<script>alert(1)</script><p onclick="alert(1)">Message</p><a href="javascript:alert(1)">bad</a><img src="https://example.com/logo.png" onerror="alert(1)" />' });
  assert.doesNotMatch(rich, /javascript:|onclick=|onerror=|<script>/);
  assert.match(rich, />Message<\/p>/);
});
test('internal alerts and failure states remain distinct, no new delivery rules', () => {
  assert.equal(emailAppearance('[APPROBATION REQUISE] Retrait NatCash').internal, true);
  assert.equal(emailAppearance('Code de vérification Super Admin').internal, true);
  assert.equal(emailAppearance('Paiement confirmé').color, '#13a875');
  assert.equal(emailAppearance('Activez votre compte Kobara').color, '#ff7a1a');
  assert.equal(emailAppearance('Retrait échoué').color, '#dc4353');
  const html = renderKobaraEmail({ subject: '[KYC EN ATTENTE] Dossier', text: 'Revue manuelle requise.' });
  assert.match(html, /USAGE INTERNE/);
  assert.match(html, /Ne pas transférer en dehors/);
  assert.doesNotMatch(html, /unsubscribe/);
});
