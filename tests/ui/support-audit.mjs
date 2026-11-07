// Isolated real component: no live ticket, account or email is created.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';import {createRoot} from 'react-dom/client';
    import {SupportClient} from './src/app/dashboard/support/support-client';
    createRoot(document.getElementById('root')).render(<SupportClient merchant={{}} user={{email:'review@example.invalid'}}/>);
  ` },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  plugins: [{ name: 'isolated-support', setup(builder) {
    builder.onResolve({ filter: /^(\.\/actions|sonner)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: args.path === 'sonner'
      ? `export const toast={error:(message)=>window.notices.push(message),success:(message)=>window.notices.push(message)};`
      : `export async function submitSupportTicket(data){window.submitted=data;await new Promise(resolve=>setTimeout(resolve,150));if(window.scenario==='exception')throw Error('Offline');return window.scenario==='error'?{error:'Indisponible'}:{success:true}}` }));
  } }],
});
const script = new TextDecoder().decode(bundle.outputFiles[0].contents).replaceAll('</script', '<\\/script');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let checks = 0;
try {
  for (const scenario of ['success', 'error', 'exception']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 740 } });
    await page.setContent(`<div id="root"></div><script>window.notices=[];window.scenario='${scenario}';${script}</script>`);
    await page.getByLabel('Catégorie', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Catégorie', { exact: true }).inputValue(), 'payment'); checks++;
    await page.getByLabel('Sujet', { exact: true }).fill('Demande fictive');
    await page.getByLabel('Votre message', { exact: true }).fill('Message réservé au test local.');
    const submit = page.locator('button[type="submit"]');
    await submit.click();
    await page.waitForFunction(() => window.submitted);
    assert.equal(await submit.isDisabled(), true); checks++;
    await page.waitForFunction(() => window.notices.length > 0);
    assert.equal(await submit.isEnabled(), true); checks++;
    if (scenario === 'success') {
      await page.getByText('Message envoyé avec succès', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Sujet', { exact: true }).inputValue(), '');
    } else {
      assert.equal(await page.getByLabel('Sujet', { exact: true }).inputValue(), 'Demande fictive');
    }
    checks++;
    await page.close();
  }
  console.log(`${checks} support accessibility and recovery checks passed.`);
} finally { await browser.close(); }
