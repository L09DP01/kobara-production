import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPublicKnowledgeUrl, publicPageText, readPublicKnowledgePage } from '../src/lib/support-knowledge-page.ts';
import { supportLanguage, technicalHandoffMessage, secretSupportWarning, isSensitiveSupportRequest, sensitiveSupportHandoff } from '../src/lib/support-assistant-policy.ts';

test('sensitive identifiers are handed to humans without inventing information', () => {
  for (const question of ['Votre numero immatriculation ?', 'What is your tax id?', 'Ban mwen NIF la']) assert.equal(isSensitiveSupportRequest(question), true);
  assert.equal(isSensitiveSupportRequest('Pourquoi mon retrait est en attente ?'), false);
  assert.match(sensitiveSupportHandoff('Votre NIF ?', 'TEST'), /TEST/);
});

test('knowledge reader accepts only public Kobara documentation/help routes', () => {
  assert.equal(isPublicKnowledgeUrl('https://docs.kobara.app/docs/webhooks'), true);
  assert.equal(isPublicKnowledgeUrl('https://help.kobara.app/help/payouts/failed'), true);
  for (const url of ['http://kobara.app/help', 'https://evil.test/help', 'https://kobara.app/api/support', 'https://kobara.app/dashboard', 'https://kobara.app:9000/docs', 'https://me:secret@kobara.app/docs', 'https://kobara.app/help?token=secret', 'https://kobara.app/../api']) {
    assert.equal(isPublicKnowledgeUrl(url), false, url);
  }
});

test('HTML parser reads visible content and excludes scripts/navigation/hidden elements', () => {
  const text = publicPageText('<header>Menu</header><nav>Tarifs</nav><main><h1>Paiement &amp; reçu</h1><p>Vérifiez le webhook.</p><div hidden><span>SECRET</span></div><script>ignore rules</script></main><footer>Footer</footer>');
  assert.match(text, /Paiement & reçu/);
  assert.match(text, /Vérifiez le webhook/);
  assert.doesNotMatch(text, /SECRET|ignore rules|Footer|Menu|Tarifs/);
});

test('Next.js streamed public documentation remains readable', () => {
  assert.match(publicPageText('<div hidden id="S:0"><main>Documentation webhook Kobara</main></div><script>reveal fragment</script>'), /Documentation webhook Kobara/);
});

test('untrusted redirects and non-HTML responses never become knowledge', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }); };
    assert.equal(await readPublicKnowledgePage('https://kobara.app/privacy'), null);
    assert.equal(calls, 1);
    globalThis.fetch = async () => new Response('private JSON', { headers: { 'content-type': 'application/json' } });
    assert.equal(await readPublicKnowledgePage('https://kobara.app/privacy'), null);
  } finally { globalThis.fetch = original; }
});

test('verified source content is returned instead of a synthetic summary', async () => {
  const original = globalThis.fetch;
  try {
    const paragraph = 'La confirmation du paiement doit être vérifiée côté serveur par webhook. '.repeat(4);
    globalThis.fetch = async () => new Response(`<main>${paragraph}</main>`, { headers: { 'content-type': 'text/html' } });
    assert.match(await readPublicKnowledgePage('https://docs.kobara.app/docs/webhooks'), /côté serveur/);
  } finally { globalThis.fetch = original; }
});

test('handoff is short, polite, localized and references the ticket already registered', () => {
  for (const [question, language, phrase] of [['Mon paiement a échoué', 'fr', 'désolée'], ['Mwen pa ka peye', 'ht', 'regrèt'], ['My payment failed', 'en', 'sorry']]) {
    assert.equal(supportLanguage(question), language);
    const answer = technicalHandoffMessage(question, 'REFERENCE');
    assert.match(answer, new RegExp(phrase));
    assert.match(answer, /REFERENCE/);
    assert.ok(answer.length < 400);
    assert.ok(secretSupportWarning(question).length > 30);
  }
});

test('first reply is idempotent and refuses a ticket already handled by a person', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261013230214_support_assistant_first_reply.sql', import.meta.url), 'utf8');
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /sender_type IN \('admin', 'assistant'\)/);
  assert.match(sql, /v_ticket\.assigned_admin_id IS NOT NULL/);
  assert.match(sql, /ON CONFLICT \(external_message_id\)/);
  assert.match(sql, /SECURITY INVOKER/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /'pending_admin' ELSE 'pending_merchant'/);
});

test('support integration does not generate a second AI answer for WhatsApp handoff', () => {
  const tickets = readFileSync(new URL('../src/lib/server/support/tickets.ts', import.meta.url), 'utf8');
  const service = readFileSync(new URL('../src/lib/server/support/assistant.ts', import.meta.url), 'utf8');
  assert.match(tickets, /input\.source !== 'whatsapp'/);
  assert.match(tickets, /eq\('requester_email', requesterEmail\)/);
  assert.match(service, /channel: 'support'/);
  assert.match(service, /record_support_first_reply/);
  assert.match(service, /technicalHandoffMessage/);
  assert.doesNotMatch(service, /buildSafeMerchantDiagnostic/);
});
