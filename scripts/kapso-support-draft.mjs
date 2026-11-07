import { createSupportDefinition, SUPPORT_WORKFLOW_NAME } from '../src/lib/kapso-support-policy.ts';

const projectId = '27701d63-735a-44f3-8982-9a52b22cf1a4';
async function request(path, method = 'GET', body) {
  if (!process.env.KAPSO_API_KEY) throw new Error('Missing KAPSO_API_KEY');
  const response = await fetch(`https://api.kapso.ai/platform/v1/${path}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { 'X-API-Key': process.env.KAPSO_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    console.error('Kapso rejected request', { status: response.status, fields: Object.keys(result.errors || {}) });
    throw new Error(`Kapso HTTP ${response.status}`);
  }
  return (await response.json()).data;
}

const numbers = await request('whatsapp/phone_numbers');
// This installation is intentionally bound to the existing Kobara sandbox, never its live number.
const sandbox = numbers.find(number => number.kind === 'sandbox' && number.id === '597907523413541');
if (!sandbox) throw new Error('Expected Kobara sandbox missing; no changes made.');
const workflows = await request('workflows');
let workflow = workflows.find(item => item.name === SUPPORT_WORKFLOW_NAME);
if (!workflow) {
  const models = await request('provider_models');
  const model = models.find(item => item.provider === 'OpenAI' && item.name === 'gpt-5.4' && item.deprecation_status === 'active');
  if (!model) throw new Error('Required active OpenAI GPT model unavailable.');
  workflow = await request('workflows', 'POST', { workflow: {
    name: SUPPORT_WORKFLOW_NAME, slug: 'kobara-support-whatsapp',
    description: 'Sandbox only. Knowledge maintained by Lorvens. No templates or production trigger.',
    definition: createSupportDefinition(model.id),
  } });
}
const graph = await request(`workflows/${workflow.id}/definition`);
if (graph.project_id !== projectId || graph.status !== 'draft') throw new Error('Unexpected project or non-draft workflow; stop.');
const triggers = await request(`workflows/${workflow.id}/triggers`);
if (!triggers.some(trigger => trigger.trigger_type === 'inbound_message' && trigger.triggerable?.phone_number_id === sandbox.id)) {
  await request(`workflows/${workflow.id}/triggers`, 'POST', { trigger: { trigger_type: 'inbound_message', phone_number_id: sandbox.id, active: false } });
}
console.log(JSON.stringify({ projectId, workflowId: workflow.id, status: graph.status,
  sandboxPhoneNumberId: sandbox.id, model: graph.definition.nodes.find(node => node.data.node_type === 'agent')?.data.config.provider_model_name,
  knowledgeBases: graph.definition.nodes.find(node => node.data.node_type === 'agent')?.data.config.flow_agent_knowledge_bases?.map(base => ({ name: base.name, empty: !base.knowledge_base_text?.trim() })),
  productionConnected: false,
}, null, 2));
