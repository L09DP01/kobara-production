// Offline component fixture: no authentication, email, Telegram or payment calls.
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('C:/Users/owner/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = process.cwd();
const stubs = {
  'next/navigation': `export const usePathname=()=>'/login/challenge-email';`,
  '@/components/auth/AuthVisual': `export const AuthVisual=()=>null;`,
  '@/components/landing/Footer': `export const Footer=()=>null;`,
  '@/components/marketing/PublicNavigation': `export const PublicHeader=()=>null;`,
};
const bundle = await build({ stdin: { loader: 'tsx', resolveDir: root, contents: `
  import React from 'react';import {createRoot} from 'react-dom/client';
  import {AuthShell} from './src/components/auth/AuthShell';
  import {PasskeyPromptModal} from './src/components/dashboard/passkey-prompt-modal';
  const root=createRoot(document.getElementById('root'));
  window.renderFixture=(view,hasPasskey=false)=>root.render(view==='prompt'?<PasskeyPromptModal accountId="fictional-owner" hasPasskey={hasPasskey}/>:<AuthShell><div className="w-full"><h1 className="text-3xl font-bold">Double validation par e-mail</h1><p className="mt-4 text-slate-300">Confirmez votre connexion avec le code de sécurité.</p><label htmlFor="otp" className="block mt-8">Code à 6 chiffres</label><input id="otp" className="w-full mt-2 p-4 rounded-lg bg-[#131B2C] text-white" inputMode="numeric"/><button className="mt-6 w-full p-4 bg-orange-600 text-white rounded-lg">Valider et se connecter</button></div></AuthShell>);
  window.renderFixture('challenge');
` }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', plugins: [{ name: 'offline', setup(builder) {
  builder.onResolve({ filter: /.*/ }, args => args.path in stubs ? { path: args.path, namespace: 'stub' } : undefined);
  builder.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: root }));
} }] });
const css = await postcss([tailwind()]).process(await fs.readFile('src/app/globals.css', 'utf8'), { from: path.join(root, 'src/app/globals.css') });
const script = bundle.outputFiles[0].text.replaceAll('</script', '<\\/script');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
let checks = 0;
try {
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/*', route => route.abort());
    await page.setContent(`<style>${css.css}</style><div id="root"></div>`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const values = new Map();
      Object.defineProperty(window, 'localStorage', { value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear() } });
    });
    await page.addScriptTag({ content: script });
    await page.getByRole('heading', { name: 'Double validation par e-mail' }).waitFor();
    assert.equal(await page.locator('main').count(), 1); checks++;
    assert.ok(await page.locator('main').evaluate(element => element.getBoundingClientRect().width <= 512)); checks++;
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); checks++;
    assert.equal(await page.locator('header,footer').count(), 0); checks++;
    if (process.env.ACCOUNT_SCREENSHOT_DIR) {
      await fs.mkdir(process.env.ACCOUNT_SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(process.env.ACCOUNT_SCREENSHOT_DIR, `email-verification-${width}.png`), fullPage: true });
    }
    await page.evaluate(() => window.renderFixture('prompt'));
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Plus tard' }).click();
    await page.evaluate(() => window.renderFixture('challenge'));
    await page.evaluate(() => window.renderFixture('prompt'));
    await page.waitForTimeout(1700);
    assert.equal(await page.getByRole('dialog').count(), 0); checks++;
    await page.evaluate(() => { localStorage.clear(); window.renderFixture('challenge'); });
    await page.evaluate(() => window.renderFixture('prompt', true));
    await page.waitForTimeout(1700);
    assert.equal(await page.getByRole('dialog').count(), 0); checks++;
    await page.close();
  }
  console.log(`${checks} account UI checks passed; no live operations.`);
} finally { await browser.close(); }
