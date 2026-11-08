import 'server-only';
import { getRuntimeEnvironmentValue } from '@/lib/server/runtime-env';
import { SUPPORT_WORKFLOW_NAME, replaceSupportKnowledge } from '@/lib/kapso-support-policy';

export class KapsoConnectionError extends Error {}

export async function kapsoRequest(path: string, method = 'GET', body?: object) {
  const key = getRuntimeEnvironmentValue('KAPSO_API_KEY');
  if (!key) throw new KapsoConnectionError('KAPSO_API_KEY est absent de cet environnement Worker.');
  let response: Response;
  try { response = await fetch(`https://api.kapso.ai/platform/v1/${path}`, {
    method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }); } catch {
    throw new KapsoConnectionError('Le Worker ne parvient pas à joindre Kapso dans le délai de 15 secondes.');
  }
  // Provider responses can contain content or credentials; never return raw errors to the browser.
  if (!response.ok) throw new KapsoConnectionError(response.status === 409 ? 'Le workflow a changé. Rechargez avant de réessayer.' : `Kapso refuse la requête (HTTP ${response.status}).${response.status === 401 || response.status === 403 ? ' Vérifiez les autorisations de la clé sur les workflows du projet.' : ''}`);
  return (await response.json()).data;
}

export async function getSupportWorkflow() {
  const projectId = getRuntimeEnvironmentValue('KAPSO_PROJECT_ID');
  if (!projectId) throw new KapsoConnectionError('KAPSO_PROJECT_ID est absent de cet environnement Worker.');
  const workflows = await kapsoRequest('workflows');
  if (!Array.isArray(workflows)) throw new KapsoConnectionError('La liste des workflows Kapso a un format inattendu.');
  const matches = workflows.filter((item: any) => item.name === SUPPORT_WORKFLOW_NAME);
  if (matches.length !== 1) throw new KapsoConnectionError(matches.length ? 'Plusieurs workflows portent le nom Kobara Support WhatsApp.' : 'Aucun workflow Kobara Support WhatsApp accessible avec cette clé.');
  const workflow = await kapsoRequest(`workflows/${encodeURIComponent(matches[0].id)}/definition`);
  if (!workflow || workflow.project_id !== projectId) throw new KapsoConnectionError('Le projet du workflow ne correspond pas à KAPSO_PROJECT_ID.');
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
