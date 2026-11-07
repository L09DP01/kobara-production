import 'server-only';
import { SUPPORT_WORKFLOW_NAME, replaceSupportKnowledge } from '@/lib/kapso-support-policy';

export async function kapsoRequest(path: string, method = 'GET', body?: object) {
  const key = process.env.KAPSO_API_KEY;
  if (!key) throw new Error('Clé serveur Kapso manquante.');
  const response = await fetch(`https://api.kapso.ai/platform/v1/${path}`, {
    method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Provider responses can contain content or credentials; never return raw errors to the browser.
  if (!response.ok) throw new Error(response.status === 409 ? 'Le workflow a changé. Rechargez avant de réessayer.' : `Kapso indisponible (${response.status}).`);
  return (await response.json()).data;
}

export async function getSupportWorkflow() {
  const workflows = await kapsoRequest('workflows');
  const matches = workflows.filter((item: any) => item.name === SUPPORT_WORKFLOW_NAME);
  if (matches.length !== 1) throw new Error('Le brouillon de support Kapso doit être configuré avant import.');
  const workflow = await kapsoRequest(`workflows/${encodeURIComponent(matches[0].id)}/definition`);
  if (workflow.project_id !== (process.env.KAPSO_PROJECT_ID || '27701d63-735a-44f3-8982-9a52b22cf1a4')) throw new Error('Le projet Kapso ne correspond pas à la configuration serveur.');
  return workflow;
}

export async function updateSupportKnowledge(content: string, expectedVersion: number) {
  const workflow = await getSupportWorkflow();
  // Keep production unchanged until the sandbox has passed its acceptance tests.
  if (workflow.status !== 'draft') throw new Error('Remettez le workflow en brouillon avant de remplacer la base.');
  if (workflow.lock_version !== expectedVersion) throw new Error('La base a changé. Rechargez la page avant de réessayer.');
  return kapsoRequest(`workflows/${encodeURIComponent(workflow.id)}`, 'PATCH', { workflow: {
    lock_version: workflow.lock_version,
    definition: replaceSupportKnowledge(workflow.definition, content),
  } });
}
