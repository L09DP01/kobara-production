import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isPublicKnowledgeUrl, publicPageText, readPublicKnowledgePage } from '../src/lib/support-knowledge-page.ts';
import { supportLanguage, technicalHandoffMessage, secretSupportWarning, isSensitiveSupportRequest, sensitiveSupportHandoff, supportIntent, explicitlyRequestsHuman, parseSupportAnswer, composeSupportReply, DOCS_ASSISTANT_URL, requiresBusinessReview } from '../src/lib/support-assistant-policy.ts';
import { knowledgeSearchQueries, rankKnowledgeDocuments } from '../src/lib/support-knowledge-ranking.ts';

const marketplaceRequest = `Madame, Monsieur, dans le cadre du développement d'une plateforme SaaS de type Marketplace, je souhaite intégrer Kobara. 1. Compte marchand principal ? 2. Versements automatisés MonCash et NatCash aux commerçants ? 3. Bénéficiaires vérifiés ? 4. Commissions et répartition ? 5. Détecter les opérations échouées et suivre leur statut ? 6. Conditions et conformité pour compte de tiers ? 7. Frais, plafonds et délais ? 8. Documentation API, sandbox et accompagnement technique ?`;

test('marketplace feasibility is not an incident or a request for a human agent', () => {
  assert.equal(supportIntent(marketplaceRequest), 'integration');
  assert.equal(requiresBusinessReview(marketplaceRequest), true);
  assert.equal(requiresBusinessReview('Comment organiser mon ledger marketplace ?'), false);
  assert.equal(explicitlyRequestsHuman(marketplaceRequest), false);
  assert.equal(explicitlyRequestsHuman('Votre équipe technique accompagne-t-elle les intégrations ?'), false);
  for (const question of ['agent', 'Je veux un humain', 'Je veux parler à un conseiller', 'Please connect me to a human', 'Mwen vle pale ak ekip la']) assert.equal(explicitlyRequestsHuman(question), true);
  assert.equal(explicitlyRequestsHuman('Votre SDK supporte-t-il un agent logiciel ?'), false);
  assert.notEqual(supportIntent('Quelles erreurs sont possibles dans une intégration marketplace ?'), 'incident');
  assert.equal(supportIntent('Mon webhook retourne une erreur 405'), 'incident');
});

test('a documented partial answer survives human validation without inventing an incident', () => {
  const result = composeSupportReply(marketplaceRequest, 'REFERENCE', {
    answer: 'Votre plateforme maintient son ledger et ses commissions. Les conditions de votre modèle restent à valider.',
    answerIsGrounded: true, shouldOfferHuman: true,
  });
  assert.equal(result.handoff, true);
  assert.match(result.answer, /ledger/);
  assert.match(result.answer, /REFERENCE/);
  assert.doesNotMatch(result.answer, /désolée|ce problème|panne/i);
  assert.ok(result.answer.includes(DOCS_ASSISTANT_URL));
});

test('a generic documentation link does not replace explicit orientation to its coding assistant', () => {
  const reply = composeSupportReply('Comment intégrer votre API ?', 'REFERENCE', { answer: `Documentation : ${DOCS_ASSISTANT_URL}`, answerIsGrounded: true, shouldOfferHuman: false });
  assert.match(reply.answer, /Kobara AI/);
});

test('coding guidance points to Docs AI even for a debugging incident', () => {
  const result = composeSupportReply('Mon webhook retourne une erreur 405', 'REFERENCE', { answer: 'Vérifiez la méthode HTTP documentée.', answerIsGrounded: true, shouldOfferHuman: false });
  assert.equal(result.handoff, false);
  assert.match(result.answer, /Kobara AI/);
  assert.ok(result.answer.includes(DOCS_ASSISTANT_URL));
});

test('coding assistant orientation is localized for Creole and English', () => {
  for (const [question, phrase] of [['Mwen bezwen èd pou ekri kòd', 'Pou ede w ekri kòd'], ['Please help me write API code', 'For coding help']]) {
    const reply = composeSupportReply(question, 'REFERENCE', { answer: 'Documented answer.', answerIsGrounded: true, shouldOfferHuman: false });
    assert.ok(reply.answer.includes(phrase));
    assert.ok(reply.answer.includes(DOCS_ASSISTANT_URL));
  }
});

test('unverified generated claims are discarded and informational fallback is neutral', () => {
  const result = composeSupportReply('Quels sont vos horaires ?', 'REFERENCE', { answer: 'Unverified invented opening hours', shouldOfferHuman: true });
  assert.equal(result.handoff, true);
  assert.doesNotMatch(result.answer, /invented|désolée|problème/);
});

test('source selection requires explicit valid safety, escalation and citation decisions', () => {
  const response = 'SAFETY_SECRET_DETECTED: false\nSUPPORT_ESCALATION_REQUIRED: true\nSUPPORT_SOURCE_IDS: 1,3\nLes paiements et le ledger sont distincts. La conformité reste à valider.';
  const parsed = parseSupportAnswer(response, 3);
  assert.equal(parsed.grounded, true);
  assert.equal(parsed.shouldOfferHuman, true);
  assert.deepEqual(parsed.sourceIds, [0, 2]);
  assert.equal(parseSupportAnswer(response.replace('1,3', '1,2,3,4,5,6,7'), 7).grounded, true);
  assert.equal(parseSupportAnswer(`${response}\n${'Une explication documentée. '.repeat(130)}`, 3).grounded, true, 'verbosity must not be mistaken for missing knowledge');
  assert.match(parseSupportAnswer(`${response}\n1. **Accès bénéficiaires :** À valider par notre équipe.`, 3).answer, /1\. À valider par notre équipe/);
  assert.doesNotMatch(parsed.answer, /SUPPORT_|SAFETY_/);
  for (const bad of [response.replace('1,3', '1,9'), response.replace('false', 'true'), response.replace('SUPPORT_SOURCE_IDS: 1,3\n', ''), response.replace('SUPPORT_ESCALATION_REQUIRED: true\n', '')]) {
    assert.equal(parseSupportAnswer(bad, 3).grounded, false);
  }
});

test('multi-topic marketplace research includes payout, compliance, pricing and sandbox queries', () => {
  const queries = knowledgeSearchQueries(marketplaceRequest);
  assert.match(queries[0], /marketplace/);
  for (const topic of ['withdrawals', 'conformite', 'tarification', 'sandbox']) assert.ok(queries.some((query) => query.includes(topic)), topic);
  assert.deepEqual(knowledgeSearchQueries('Pourquoi mon paiement est pending ?'), ['Pourquoi mon paiement est pending ?']);
  assert.equal(knowledgeSearchQueries('Quels frais appliquez-vous ?')[0], 'tarifs tarification paiements frais');
});

test('repeating generic payment keywords cannot outrank a topic-specific marketplace article', () => {
  const ranked = rankKnowledgeDocuments([
    { title: 'Plugin WooCommerce', searchText: 'paiement moncash natcash api '.repeat(200) },
    { title: 'Marketplace et commissions', searchText: 'marketplace ledger commissions paiement moncash natcash api' },
  ], 'marketplace commissions paiement moncash natcash api', 2);
  assert.equal(ranked[0].title, 'Marketplace et commissions');
});

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
  assert.match(service, /composeSupportReply/);
  assert.doesNotMatch(service, /buildSafeMerchantDiagnostic/);
});
