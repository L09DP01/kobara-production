const { chromium } = require('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const { renderKobaraEmail } = await import(pathToFileURL(path.join(root, 'src/lib/server/email/template.ts')).href);
  const cases = [
    { subject: 'Code de connexion', text: 'Bonjour Camille, confirmez votre connexion.', presentation: { type: 'otp', purpose: 'login', intro: 'Une connexion depuis un nouvel appareil nécessite votre confirmation. Saisissez ce code sur l’écran de connexion Kobara.', code: '123456', expiresInMinutes: 10 } },
    { subject: 'Information importante pour votre compte', text: 'Bonjour Camille, retrouvez les informations de votre compte.' },
    ...['pending', 'approved', 'succeeded', 'failed', 'rejected', 'cancelled'].map(status => ({
      subject: 'Votre paiement', text: 'Bonjour, votre transaction a ete enregistree.',
      presentation: { type: 'transaction', source: 'payment_link', status, amount: 2500, currency: 'HTG', reference: 'KBR-DEMO-00251', date: '25 octobre 2026, 10:30', method: 'MonCash', merchantName: 'Boutique Demonstration', description: 'Formation en ligne', intro: 'Bonjour, votre transaction a ete enregistree aupres de Boutique Demonstration.', notice: status === 'succeeded' ? 'Votre paiement a bien ete enregistre. Conservez cette reference pour vos dossiers.' : undefined, action: { url: 'https://example.com/payment', label: 'Voir la transaction' } },
    })),
    { subject: 'Votre retrait', text: 'Votre retrait a ete execute avec succes.', presentation: { type: 'transaction', operation: 'withdrawal', status: 'succeeded', amount: 2500, currency: 'HTG', reference: 'WTH-DEMO-00128', date: '25 octobre 2026, 10:30', method: 'MonCash', merchantName: 'Boutique Demonstration', description: 'Retrait vers MonCash', notice: 'Votre retrait a bien ete execute. Conservez cette reference pour vos dossiers.', action: { url: 'https://example.com/withdrawal', label: 'Voir le retrait' } } },
    ...[
      ['security', 'Mot de passe modifié', 'Le mot de passe de votre compte a été modifié. Si vous ne reconnaissez pas cette action, contactez le support.'],
      ['verification', 'Votre dossier est en cours d’examen', 'Nous avons reçu vos documents. Consultez votre tableau de bord pour suivre votre vérification.'],
      ['support', 'Réponse de l’assistant Kobara', 'Bonjour Camille, vérifiez que votre webhook est accessible et répond avec un code HTTP 200.'],
      ['invitation', 'Rejoignez Boutique Démonstration', 'Vous êtes invité à rejoindre cette entreprise. Votre accès sera limité aux autorisations du rôle attribué.'],
      ['classic', 'Information concernant votre compte', 'Bonjour Camille,\n\nRetrouvez les informations de votre compte dans votre tableau de bord.\n\nL’équipe Kobara'],
      ['internal', 'Un dossier nécessite une revue manuelle', 'Dossier DEMO-1042\nMotif : vérification complémentaire nécessaire.'],
      ['marketing', 'Les nouveautés Kobara', 'Bonjour Camille, retrouvez les nouveautés pour votre activité.'],
    ].map(([purpose, subject, text]) => ({ subject, text, kind: purpose === 'marketing' ? 'marketing' : 'transactional', presentation: { type: 'message', purpose }, ...(purpose === 'marketing' ? { html: '<h1>Les nouveautés Kobara</h1><p>Retrouvez les nouveautés pour votre activité.</p><a href="https://example.com/unsubscribe?token=demo">Se désabonner</a>' } : {}) })),
  ];
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const folder = process.env.EMAIL_SCREENSHOT_DIR || path.join(process.env.TEMP, 'kobara-email-models');
    fs.mkdirSync(folder, { recursive: true });
    let checks = 0;
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      for (let index = 0; index < cases.length; index++) {
        let html = renderKobaraEmail(cases[index]);
        // Embed unchanged official files for offline visual checks only.
        for (const logo of ['logo.png', 'logo2.png']) {
          html = html.replaceAll(`https://kobara.app/${logo}`, `data:image/png;base64,${fs.readFileSync(path.join(root, 'public', logo)).toString('base64')}`);
        }
        await page.setContent(html, { waitUntil: 'load' });
        const result = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          logos: [...document.images].every(img => img.complete && img.naturalWidth > 0),
          placeholders: document.body.innerText.includes('{{'),
        }));
        if (result.overflow || !result.logos || result.placeholders) throw Error(JSON.stringify({ width, index, result }));
        checks++;
        if (width === 390) await page.screenshot({ path: path.join(folder, `model-${index}.png`), fullPage: true });
      }
    }
    console.log(`${checks} responsive checks passed. Screenshots: ${folder}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
