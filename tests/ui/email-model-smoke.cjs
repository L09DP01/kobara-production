const { chromium } = require('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const root = path.resolve(__dirname, '../..');
  const { renderKobaraEmail } = await import(pathToFileURL(path.join(root, 'src/lib/server/email/template.ts')).href);
  const cases = [
    { subject: 'Code de connexion', text: 'Bonjour Camille, confirmez votre connexion.', presentation: { type: 'otp', code: '123456', expiresInMinutes: 10 } },
    { subject: 'Information importante pour votre compte', text: 'Bonjour Camille, retrouvez les informations de votre compte.' },
    ...['pending', 'approved', 'succeeded', 'failed', 'rejected', 'cancelled'].map(status => ({
      subject: 'Votre paiement', text: 'Bonjour Camille, voici votre operation de demonstration.',
      presentation: { type: 'transaction', status, amount: 4500, currency: 'HTG', reference: 'DEMO-1', merchantName: 'Boutique Exemple', action: { url: 'https://example.com/payment', label: 'Consulter' } },
    })),
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
