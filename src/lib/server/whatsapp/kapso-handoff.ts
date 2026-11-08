import 'server-only';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { redactSecrets } from '@/lib/sensitive-text';

const RETENTION_SECONDS = 30 * 24 * 60 * 60;
type Store = {
  get(key: string): Promise<unknown>;
  set(key: string, value: string, options: { nx?: boolean; ex: number }): Promise<unknown>;
};
type Dependencies = {
  secret: string;
  projectId: string;
  workflowId: string;
  recipient: string;
  store: Store;
  send: (message: { to: string; subject: string; text: string; idempotencyKey: string }) => Promise<{ success: boolean }>;
  now?: () => number;
};

function cleanSummary(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return 'Aucun résumé communiqué. Consultez la conversation dans Kapso.';
  return redactSecrets(value)
    .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g, '[SECRET MASQUE]')
    .replace(/\b(?:sk-proj-|kapso_sk_|ghp_)[A-Za-z0-9_-]{12,}\b/g, '[SECRET MASQUE]')
    .replace(/\b(?:mot de passe|password|code otp|otp|code de securite|code de sécurité)\s*[:=]\s*\S+/gi, '[SECRET MASQUE]')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, 4000);
}

export async function handleKapsoHandoff(raw: Uint8Array, signature: string | null, deps: Dependencies) {
  if (!deps.secret || !deps.projectId || !deps.workflowId || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(deps.recipient)) {
    return new Response('Handoff alerts unavailable', { status: 503 });
  }
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return new Response('Unauthorized', { status: 401 });
  const expected = createHmac('sha256', deps.secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return new Response('Unauthorized', { status: 401 });
  let event: any;
  try { event = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { return new Response('Invalid payload', { status: 400 }); }
  if (event?.project_id !== deps.projectId) return new Response('Forbidden', { status: 403 });
  if (event.event !== 'workflow.execution.handoff' || event.workflow_id !== deps.workflowId) return new Response(null, { status: 204 });
  const id = event.workflow_execution_id;
  const occurred = event.occurred_at;
  const timestamp = typeof occurred === 'string' ? Date.parse(occurred) : NaN;
  const now = (deps.now || Date.now)();
  if (event.status !== 'handoff' || event.channel !== 'whatsapp' || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)
    || !Number.isFinite(timestamp) || timestamp > now + 300000 || now - timestamp > 7 * 86400000) {
    return new Response('Invalid handoff', { status: 400 });
  }
  // Derive replay identity from signed fields, never unsigned delivery headers.
  const digest = createHash('sha256').update(JSON.stringify([deps.projectId, deps.workflowId, id, occurred])).digest('hex');
  const key = `kapso:handoff-email:${digest}`;
  try {
    if (await deps.store.get(key) === 'sent') return new Response(null, { status: 204 });
    if (!await deps.store.set(key, 'pending', { nx: true, ex: RETENTION_SECONDS })) {
      return new Response('Delivery pending verification', { status: 503 });
    }
    const result = await deps.send({
      to: deps.recipient,
      subject: 'Kobara Support - transfert WhatsApp vers un conseiller',
      text: [
        'Une conversation WhatsApp a été transférée à un conseiller humain dans Kapso.',
        `Date : ${new Date(timestamp).toISOString()}`,
        `Référence de suivi Kapso : ${id}`,
        'Résumé fourni au transfert (informations déclaratives, non vérifiées) :',
        cleanSummary(event.handoff?.reason),
        'Ouvrez l\'Inbox du projet Kobara dans https://app.kapso.ai pour prendre en charge la conversation.',
        'Cet e-mail ne crée pas de ticket Kobara et ne modifie pas le compte du client.',
      ].join('\n\n'),
      idempotencyKey: `kapso-handoff-${digest}`,
    });
    if (!result.success) throw new Error('Email not confirmed');
    await deps.store.set(key, 'sent', { ex: RETENTION_SECONDS });
    return new Response(null, { status: 204 });
  } catch {
    // Keep the pending marker on ambiguous delivery; do not double-send a security alert.
    console.error('[Kapso] Handoff email requires delivery verification', { event: digest });
    return new Response('Delivery requires verification', { status: 503 });
  }
}
