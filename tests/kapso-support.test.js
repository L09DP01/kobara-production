import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createHash } from 'node:crypto';

const source = file => fs.readFileSync(new URL(file, import.meta.url), 'utf8');
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(source(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const policy = load('../src/lib/kapso-support-policy.ts');
const bytes = text => new TextEncoder().encode(text);
const graph = () => policy.createSupportDefinition('fixture-openai-model');

function connection(env, fetch) {
  return load('../src/lib/server/whatsapp/kapso.ts', {
    'server-only': {},
    '@/lib/server/runtime-env': { getRuntimeEnvironmentValue: name => env[name] || '' },
    '@/lib/kapso-support-policy': policy,
  }, { fetch });
}
test('Kapso missing project fails before any network request', async () => {
  const api = connection({}, () => { throw Error('must not call'); });
  await assert.rejects(api.getSupportWorkflow(), error => error instanceof api.KapsoConnectionError && error.message.includes('KAPSO_PROJECT_ID'));
});
test('Kapso reports HTTP refusal without exposing provider response or key', async () => {
  const api = connection({ KAPSO_API_KEY: 'fixture-key', KAPSO_PROJECT_ID: 'fixture-project' }, async () => new Response('private provider details', { status: 403 }));
  await assert.rejects(api.getSupportWorkflow(), error => error instanceof api.KapsoConnectionError && error.message.includes('403') && !error.message.includes('private') && !error.message.includes('fixture-key'));
});
test('Kapso network exceptions are sanitized', async () => {
  const api = connection({ KAPSO_API_KEY: 'fixture-key' }, async () => { throw Error('secret network details'); });
  await assert.rejects(api.kapsoRequest('workflows'), error => error instanceof api.KapsoConnectionError && !error.message.includes('secret'));
});
test('Kapso distinguishes immediate network errors from actual timeouts', async () => {
  for (const [name, message, expected] of [
    ['TimeoutError', 'private timeout details', '15 secondes'],
    ['TypeError', 'Unsupported cache mode: no-store', 'cache'],
    ['TypeError', 'Redirect encountered', 'redirection'],
    ['TypeError', 'DNS lookup failed', 'résoudre'],
    ['TypeError', 'TLS certificate failed', 'TLS'],
  ]) {
    const api = connection({ KAPSO_API_KEY: 'fixture-key' }, async () => { const error = new Error(message); error.name = name; throw error; });
    await assert.rejects(api.kapsoRequest('workflows'), error => error instanceof api.KapsoConnectionError && error.message.includes(expected));
  }
});
test('Kapso reads configuration from runtime bindings', async () => {
  const api = connection({ KAPSO_API_KEY: 'fixture-key', KAPSO_PROJECT_ID: 'fixture-project' }, async url => Response.json({ data: url.endsWith('/definition') ? { project_id: 'fixture-project', status: 'active' } : [{ id: 'fixture-workflow', name: policy.SUPPORT_WORKFLOW_NAME }] }));
  assert.equal((await api.getSupportWorkflow()).status, 'active');
});

for (const name of ['official.txt', 'official.md', 'OFFICIAL.MD']) test(`accepts ${name}`, () => {
  assert.equal(policy.validateKnowledgeFile(name, bytes('Fait officiel.')), 'Fait officiel.');
});
for (const name of ['file.pdf', 'file.html', 'file.docx', 'file.txt.exe']) test(`rejects ${name}`, () => {
  assert.throws(() => policy.validateKnowledgeFile(name, bytes('content')));
});
test('rejects zero byte content', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', bytes(''))));
test('rejects whitespace content', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', bytes('  \n'))));
test('rejects oversized files by bytes', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', new Uint8Array(policy.MAX_KNOWLEDGE_BYTES + 1))));
test('rejects invalid UTF8', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', Uint8Array.of(0xff))));
test('rejects binary control characters', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', bytes('text\0'))));
test('normalizes BOM and CRLF', () => assert.equal(policy.validateKnowledgeFile('a.txt', bytes('\uFEFFBonjour\r\nKobara')), 'Bonjour\nKobara'));
test('rejects private key material', () => assert.throws(() => policy.validateKnowledgeFile('a.txt', bytes('-----BEGIN PRIVATE KEY-----'))));
test('three nodes and deterministic handoff fallback', () => {
  const value = graph();
  assert.deepEqual(value.nodes.map(n => n.data.node_type), ['start', 'agent', 'handoff']);
  assert.equal(value.edges[1].target, value.nodes[2].id);
});
test('only one empty knowledge tool and no external data tools', () => {
  const config = graph().nodes[1].data.config;
  assert.equal(config.flow_agent_knowledge_bases.length, 1);
  assert.equal(config.flow_agent_knowledge_bases[0].knowledge_base_text, '');
  assert.deepEqual(config.flow_agent_webhooks, []);
  assert.deepEqual(config.flow_agent_mcp_servers, []);
  assert.deepEqual(config.flow_agent_function_tools, []);
});
test('all requested default tools enabled', () => assert.deepEqual(graph().nodes[1].data.config.enabled_default_tools, ['handoff_to_human', 'enter_waiting', 'complete_task', 'get_whatsapp_context', 'get_current_datetime']));
test('preserves the exact system prompt prefix', () => assert.ok(graph().nodes[1].data.config.system_prompt.startsWith(policy.SUPPORT_SYSTEM_PROMPT + '\n')));
test('knowledge replacement preserves model, prompt, graph and original object', () => {
  const old = graph();
  const updated = policy.replaceSupportKnowledge(old, 'Fait validé par Lorvens.');
  assert.equal(old.nodes[1].data.config.flow_agent_knowledge_bases[0].knowledge_base_text, '');
  assert.equal(updated.nodes[1].data.config.system_prompt, old.nodes[1].data.config.system_prompt);
  assert.equal(updated.nodes[1].data.config.provider_model_id, 'fixture-openai-model');
  assert.deepEqual(updated.edges, old.edges);
  assert.equal(updated.nodes[1].data.config.flow_agent_knowledge_bases[0].knowledge_base_text, 'Fait validé par Lorvens.');
});
test('rejects missing or duplicate agents', () => {
  assert.throws(() => policy.replaceSupportKnowledge({ nodes: [], edges: [] }, 'x'));
  const old = graph(); old.nodes.push(old.nodes[1]);
  assert.throws(() => policy.replaceSupportKnowledge(old, 'x'));
});
test('rejects multiple knowledge bases', () => {
  const old = graph(); old.nodes[1].data.config.flow_agent_knowledge_bases.push({ name: 'other' });
  assert.throws(() => policy.replaceSupportKnowledge(old, 'x'));
});
test('rejects a different knowledge base', () => {
  const old = graph(); old.nodes[1].data.config.flow_agent_knowledge_bases[0].name = 'other';
  assert.throws(() => policy.replaceSupportKnowledge(old, 'x'));
});
test('retired webhook never schedules AI or sends notifications', async () => {
  const route = load('../src/app/api/webhooks/whatsapp/route.ts');
  assert.equal((await route.GET()).status, 410);
  assert.equal((await route.POST()).status, 410);
});

function actionFixture({ email = 'lorvensondp4282@gmail.com', authorized = true, ownerId = '', auditError = false } = {}) {
  const calls = { update: 0, audit: 0 };
  const action = load('../src/app/system-core/(protected)/whatsapp/knowledge/actions.ts', {
    'node:crypto': { createHash }, 'next/cache': { revalidatePath() {} },
    '@/lib/auth/require-admin': { async requireAdmin(roles) {
      assert.deepEqual(roles, ['super_admin']);
      if (!authorized) throw new Error('Unauthorized');
      return { user: { id: 'founder', email } };
    } },
    '@/utils/supabase/admin': { createAdminClient: () => ({ from: () => ({ insert: async () => { calls.audit++; return { error: auditError }; } }) }) },
    '@/lib/kapso-support-policy': policy,
    '@/lib/server/whatsapp/kapso': { async updateSupportKnowledge(content, version) { calls.update++; assert.equal(content, 'Official fixture.'); assert.equal(version, 0); } },
  }, { process: { env: { KAPSO_KNOWLEDGE_OWNER_ADMIN_ID: ownerId } } });
  const form = new FormData(); form.set('knowledge', new File(['Official fixture.'], 'official.txt'));
  form.set('version', '0'); form.set('approved', 'on');
  return { calls, form, run: () => action.importSupportKnowledge({ success: false, message: '' }, form) };
}
test('unauthenticated imports cannot access Kapso', async () => {
  const f = actionFixture({ authorized: false }); assert.equal((await f.run()).success, false); assert.equal(f.calls.update, 0);
});
test('a different super admin cannot change the founder knowledge', async () => {
  const f = actionFixture({ email: 'other@example.invalid' }); assert.equal((await f.run()).success, false); assert.equal(f.calls.audit, 0);
});
test('configured owner ID takes precedence over email', async () => {
  const f = actionFixture({ ownerId: 'different-owner' }); assert.equal((await f.run()).success, false); assert.equal(f.calls.update, 0);
});
test('missing content approval blocks import', async () => {
  const f = actionFixture(); f.form.delete('approved'); assert.equal((await f.run()).success, false); assert.equal(f.calls.update, 0);
});
test('audit failure blocks import', async () => {
  const f = actionFixture({ auditError: true }); assert.equal((await f.run()).success, false); assert.equal(f.calls.update, 0);
});
test('founder imports only after audit succeeds', async () => {
  const f = actionFixture(); assert.equal((await f.run()).success, true); assert.equal(f.calls.update, 1); assert.equal(f.calls.audit, 1);
});
