import test from 'node:test';
import assert from 'node:assert/strict';
import { renderKobaraEmail, emailAppearance } from '../src/lib/server/email/template.ts';

test('all email variants support dark palettes and official logo fallback', () => {
  for (const presentation of [undefined, { type: 'otp', code: '123456', expiresInMinutes: 10 }, { type: 'transaction', status: 'failed', amount: 2500, currency: 'HTG' }]) {
    const html = renderKobaraEmail({ subject: 'Information', text: 'Contenu réel conservé.', presentation });
    assert.match(html, /name="color-scheme" content="light dark"/);
    assert.match(html, /@media\(prefers-color-scheme:dark\)/);
    assert.match(html, /\[data-ogsc\]/);
    assert.match(html, /class="email-logo-dark"/);
    assert.match(html, /mso-hide:all/);
    assert.match(html, /email-logo-light/);
    assert.match(html, /Contenu réel conservé/);
    assert.doesNotMatch(html, /<script/);
  }
});

test('message purposes have contextual labels without inventing a transaction status', () => {
  for (const purpose of ['classic', 'security', 'verification', 'support', 'invitation', 'marketing', 'internal']) {
    const html = renderKobaraEmail({ subject: 'Information', text: 'Bonjour Camille, votre message.', presentation: { type: 'message', purpose, heading: 'Votre dossier', context: 'Référence DEMO-1' } });
    assert.match(html, new RegExp(`data-purpose="${purpose}"`));
    assert.match(html, /Votre dossier/);
    assert.match(html, /Référence DEMO-1/);
    assert.doesNotMatch(html, /MESSAGE DE KOBARA|Paiement réussi|MONTANT DE LA TRANSACTION/);
    assert.equal(html.includes('jamais votre mot de passe'), purpose === 'security');
    assert.equal(html.includes('Ne pas transférer en dehors'), purpose === 'internal');
  }
});

test('classic messages preserve paragraphs and unsafe CTA links are not buttons', () => {
  const html = renderKobaraEmail({ subject: 'Information', text: '', html: '<p>Bonjour,</p><p>Votre courrier.</p><p><strong>2500 HTG</strong></p><a style="background:orange" href="https://user:password@example.com">Consulter</a>' });
  assert.match(html, /Bonjour,/);
  assert.match(html, /Votre courrier/);
  assert.doesNotMatch(html, /href="https:\/\/user:password|<p[^>]*><p/);
});

test('plain alert details become readable rows without changing their values', () => {
  const html = renderKobaraEmail({ subject: '[KYC EN ATTENTE] Dossier', text: 'Entreprise : Boutique Démonstration\nStatut KYC : EN ATTENTE\nScore : 72/100\n━━━━━━━━━━━━━━━━\nExamen manuel nécessaire.' });
  assert.match(html, /<table role="presentation"/);
  assert.match(html, /Boutique Démonstration/);
  assert.match(html, /EN ATTENTE/);
  assert.match(html, /72\/100/);
  assert.match(html, /Examen manuel nécessaire/);
  assert.doesNotMatch(html, /━━━━━━━━/);
});

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

test('explicit OTP model uses real expiry and matching logo backgrounds', () => {
  const html = renderKobaraEmail({ subject: 'Code de connexion', text: 'Bonjour, saisissez votre code.', presentation: { type: 'otp', code: '654321', expiresInMinutes: 12 } });
  assert.match(html, /data-template="otp"/);
  assert.match(html, /<code[^>]*>654321<\/code>/);
  assert.match(html, /Valable pendant 12 minutes/);
  assert.doesNotMatch(html, /5 minutes|Super Admin|\{\{/);
  assert.ok(html.indexOf('logo.png') < html.indexOf('background:#101a34;color:#c9d2e4'));
  assert.ok(html.lastIndexOf('logo2.png') > html.indexOf('background:#101a34;color:#c9d2e4'));
});

test('OTP purposes use the actual code expiry and action-specific safety guidance', () => {
  for (const purpose of ['login', 'withdrawal', 'transfer', 'support', 'admin']) {
    const html = renderKobaraEmail({ subject: 'Code de vérification', text: 'Legacy content 654321', presentation: { type: 'otp', purpose, code: '654321', expiresInMinutes: purpose === 'admin' ? 5 : 10, internal: purpose === 'admin', intro: 'Confirmez uniquement votre propre demande.', details: [{ label: 'Référence', value: '<DEMO>' }] } });
    assert.equal((html.match(/>654321<\/code>/g) || []).length, 1);
    assert.match(html, new RegExp(`Valable pendant ${purpose === 'admin' ? 5 : 10} minutes`));
    assert.match(html, /&lt;DEMO&gt;/);
    assert.match(html, /Usage unique/);
    assert.doesNotMatch(html, /Legacy content/);
    assert.equal(html.includes('conversation WhatsApp'), purpose === 'support');
    assert.equal(html.includes('Ne partagez ce code'), purpose !== 'support');
  }
  assert.throws(() => renderKobaraEmail({ subject: 'Code', text: '', presentation: { type: 'otp', code: 'invalid', expiresInMinutes: 5 } }), /Invalid OTP/);
});

test('transaction state comes from backend data, not a misleading subject', () => {
  const html = renderKobaraEmail({ subject: 'Paiement reçu', text: 'Votre opération.', presentation: { type: 'transaction', status: 'failed', amount: 123.45, currency: 'HTG', reference: 'DEMO-1', merchantName: '<Boutique>', action: { url: 'javascript:alert(1)', label: 'Payer' } } });
  assert.match(html, /data-template="transaction"/);
  assert.match(html, /échoué/i);
  assert.match(html, /#b42335/);
  assert.match(html, /123,45 HTG/);
  assert.match(html, /&lt;Boutique&gt;/);
  assert.doesNotMatch(html, /javascript:|>Payer<|\{\{|Confirmé/);
  for (const status of ['pending', 'approved', 'succeeded', 'failed', 'rejected', 'cancelled']) {
    const rendered = renderKobaraEmail({ subject: 'Opération', text: '', presentation: { type: 'transaction', status, action: { url: 'https://pay.example/valid', label: 'Consulter' } } });
    assert.match(rendered, /href="https:\/\/pay.example\/valid"/);
    assert.doesNotMatch(rendered, /Détails de la transaction|MONTANT DE LA TRANSACTION|\{\{/);
  }
});

test('API receipts hide product description while link receipts show it', () => {
  const input = { subject: 'Paiement', text: '', presentation: { type: 'transaction', status: 'succeeded', description: 'Formation privee', amount: 2500, currency: 'HTG' } };
  const api = renderKobaraEmail({ ...input, presentation: { ...input.presentation, source: 'api' } });
  const link = renderKobaraEmail({ ...input, presentation: { ...input.presentation, source: 'payment_link' } });
  assert.doesNotMatch(api, /Description|Formation privee/);
  assert.match(link, /Description/);
  assert.match(link, /Formation privee/);
  assert.match(link, /2\s500,00 HTG/);
});

test('withdrawal receipt uses withdrawal wording and never claims approval is completed', () => {
  for (const status of ['pending', 'approved', 'succeeded', 'failed']) {
    const html = renderKobaraEmail({ subject: 'Retrait', text: 'Details du retrait.', presentation: { type: 'transaction', operation: 'withdrawal', status, amount: 2500, currency: 'HTG' } });
    assert.match(html, /Retrait/);
    assert.doesNotMatch(html, /Paiement réussi|Votre paiement est confirmé/);
    if (status === 'approved') {
      assert.match(html, /exécution en attente/);
      assert.doesNotMatch(html, /Retrait réussi/);
    }
  }
});
