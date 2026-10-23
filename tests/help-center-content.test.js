import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import ts from 'typescript';
import { publishedHelpArticles, getHelpArticle, getHelpCategory, getHelpArticleHref } from '../src/lib/help-center-content.ts';

const newPaths = ['security/account-suspended', 'verification/reverify-after-unblock',
  'verification/duplicate-identity', 'verification/kyc-in-review', 'payments/shopify-payment-link'];

test('new support articles are published, categorized and reachable with valid related links', () => {
  assert.equal(new Set(publishedHelpArticles.map(item => item.path)).size, publishedHelpArticles.length);
  assert.equal(new Set(publishedHelpArticles.map(item => item.id)).size, publishedHelpArticles.length);
  for (const path of newPaths) {
    const article = getHelpArticle(path);
    assert.ok(article, path);
    assert.equal(article.lastReviewedAt, '2026-10-23');
    assert.ok(getHelpCategory(article.category));
    assert.equal(getHelpArticleHref(article), `/help/${path}`);
    assert.ok(article.sections.length >= 2);
    for (const related of article.relatedArticles) assert.ok(getHelpArticle(related), related);
  }
});

test('suspension and reverification advice preserves restrictions and protects other account holders', () => {
  const suspension = JSON.stringify(getHelpArticle('security/account-suspended'));
  assert.match(suspension, /ne signifie pas automatiquement/);
  assert.match(suspension, /ne divulgue pas les informations personnelles/);
  assert.match(suspension, /Aucun délai ni résultat de déblocage n’est garanti/);
  const reverify = JSON.stringify(getHelpArticle('verification/reverify-after-unblock'));
  assert.match(reverify, /Revérifier mon identité/);
  assert.match(reverify, /ancien dossier approuvé ne remplace pas/);
  assert.match(reverify, /opérations financières restent soumises aux restrictions/);
});

test('removed withdrawal-code article is absent and help content does not name the technical payment provider', () => {
  assert.equal(getHelpArticle('security/withdrawal-code'), undefined);
  assert.doesNotMatch(JSON.stringify(publishedHelpArticles), /\bpay[’'\s-]*m\b/i);
  for (const article of publishedHelpArticles) assert.ok(!article.relatedArticles.includes('security/withdrawal-code'));
});

test('Shopify article distinguishes order confirmation from payment and documents the email flow', () => {
  const text = JSON.stringify(getHelpArticle('payments/shopify-payment-link'));
  assert.match(text, /n’est pas une preuve de paiement/);
  assert.match(text, /ne redirige pas automatiquement/);
  assert.match(text, /taux configuré par le marchand/);
  assert.match(text, /pas dans la liste générale/);
});

test('public help API exposes suspension and verification articles to search consumers', async () => {
  const require = createRequire(import.meta.url);
  const source = fs.readFileSync(new URL('../src/app/api/help/articles/route.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  const mocks = { '@/lib/help-center-content': { publishedHelpArticles }, 'next/server': { NextResponse: { json: data => Response.json(data) } } };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  for (const query of ['suspendu', 'revérifier', 'doublon', 'Shopify', 'kont mwen bloke']) {
    const response = await module.exports.GET({ nextUrl: new URL(`https://help.example/api/help/articles?q=${encodeURIComponent(query)}`) });
    const data = await response.json();
    assert.ok(data.count > 0, query);
  }
  const response = await module.exports.GET({ nextUrl: new URL('https://help.example/api/help/articles?path=security/account-suspended') });
  assert.equal((await response.json()).count, 1);
});
