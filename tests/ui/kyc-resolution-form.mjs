// Local UI fixture only: never invokes KYC, email or account operations.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const bundle = await build({ stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {KycResolutionForm} from './src/app/system-core/(protected)/kyc/resolution-form';
  async function action(previous,data){window.submitted=data.get('fraud_case_id');await new Promise(resolve=>setTimeout(resolve,200));return {error:window.simulateError?'Erreur de demonstration':''}}
  createRoot(document.getElementById('root')).render(<KycResolutionForm action={action}><input type="hidden" name="fraud_case_id" value="fictional-case"/><button type="submit">Enregistrer</button></KycResolutionForm>);
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic' });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage();
  await page.setContent(`<div id="root"></div><script>window.simulateError=true;${new TextDecoder().decode(bundle.outputFiles[0].contents).replaceAll('</script', '<\\/script')}</script>`);
  const button = page.getByRole('button', { name: 'Enregistrer' });
  await button.click();
  await page.getByRole('status').waitFor();
  assert.equal(await button.isDisabled(), true);
  await page.getByRole('alert').waitFor();
  assert.equal(await button.isEnabled(), true);
  assert.equal(await page.evaluate(() => window.submitted), 'fictional-case');
  await page.evaluate(() => { window.simulateError = false; });
  await button.click();
  await page.getByRole('status').waitFor();
  await page.getByRole('status').waitFor({ state: 'hidden' });
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.equal(await button.isEnabled(), true);
  console.log('5 KYC resolution form checks passed; no live account operations.');
} finally { await browser.close(); }
