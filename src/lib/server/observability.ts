import 'server-only';
import { requireAdmin } from '@/lib/auth/require-admin';

export type ProviderLog = { id: string; time: string; source: string; level: string; message: string };
export type LogResult = { state: 'ok' | 'unconfigured' | 'error'; detail: string; rows: ProviderLog[] };

export function sanitizeLog(value: unknown): string {
  let text = String(value ?? '').slice(0, 12000);
  // Provider logs may contain arbitrary request headers and credentials.
  for (const [key, secret] of Object.entries(process.env)) {
    if (/TOKEN|SECRET|PASSWORD|API_KEY|PEPPER|SMTP_PASS/i.test(key) && secret && secret.length >= 8) text = text.split(secret).join('[SECRET MASQUE]');
  }
  return text.replace(/\bBearer\s+\S+/gi, 'Bearer [MASQUE]')
    .replace(/\b(?:kbr_(?:sk|pk)_(?:live|test)_|sk_live_|sk_test_|sb_secret_|EAAP)[\w.-]+/g, '[SECRET MASQUE]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[JWT MASQUE]')
    .replace(/((?:password|secret|token|api[_-]?key|authorization|cookie)["']?\s*[:=]\s*)["']?[^\s,;}]+/gi, '$1[MASQUE]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL MASQUE]')
    .slice(0, 2000);
}

async function readJson(url: string, token: string, body?: unknown) {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`API fournisseur : HTTP ${response.status}`);
  return response.json();
}

export async function readProviderLogs(provider: 'supabase' | 'cloudflare'): Promise<LogResult> {
  await requireAdmin(['super_admin', 'operations']);
  const now = Date.now();
  try {
    if (provider === 'supabase') {
      const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
      const ref = process.env.SUPABASE_PROJECT_REF;
      if (!token || !ref) return { state: 'unconfigured', detail: 'Accès aux logs Supabase non configuré : SUPABASE_MANAGEMENT_TOKEN et SUPABASE_PROJECT_REF.', rows: [] };
      if (!/^[a-z0-9]+$/.test(ref)) throw new Error('Référence projet invalide');
      const query = new URLSearchParams({ sql: 'SELECT timestamp, event_message, source FROM logs ORDER BY timestamp DESC LIMIT 100', iso_timestamp_start: new Date(now - 3600000).toISOString(), iso_timestamp_end: new Date(now).toISOString() });
      const data = await readJson(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs?${query}`, token);
      if (data.error) throw new Error('Requête de logs Supabase refusée');
      if (!Array.isArray(data.result)) throw new Error('Format de logs Supabase inattendu');
      return { state: 'ok', detail: 'Dernières 60 minutes · 100 événements maximum', rows: data.result.slice(0, 100).map((row: any, i: number) => ({ id: String(i), time: String(row.timestamp || ''), source: String(row.source || 'supabase'), level: /error|fatal/i.test(row.event_message || '') ? 'error' : 'info', message: sanitizeLog(row.event_message) })) };
    }
    const token = process.env.CLOUDFLARE_OBSERVABILITY_TOKEN;
    const account = process.env.CLOUDFLARE_ACCOUNT_ID;
    const queryId = process.env.CLOUDFLARE_LOG_QUERY_ID;
    if (!token || !account || !queryId) return { state: 'unconfigured', detail: 'Accès aux logs Cloudflare non configuré : CLOUDFLARE_OBSERVABILITY_TOKEN, CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_LOG_QUERY_ID (requête enregistrée limitée au Worker Kobara).', rows: [] };
    if (!/^[a-f0-9]{32}$/i.test(account)) throw new Error('Compte Cloudflare invalide');
    const data = await readJson(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/observability/telemetry/query`, token, { queryId, timeframe: { from: now - 3600000, to: now }, view: 'events', limit: 100 });
    if (!data.success || data.errors?.length) throw new Error('Requête de logs Cloudflare refusée');
    const events = data.result?.events?.events;
    if (!Array.isArray(events)) throw new Error('Format de logs Cloudflare inattendu : la requête doit afficher des événements');
    return { state: 'ok', detail: 'Dernières 60 minutes · 100 événements maximum', rows: events.slice(0, 100).map((event: any, i: number) => { const meta = event.$metadata || {}; return { id: String(meta.id || i), time: String(event.timestamp || meta.startTime || ''), source: String(meta.service || 'cloudflare'), level: String(meta.level || (meta.error ? 'error' : 'info')), message: sanitizeLog(meta.message || meta.error || event.source?.message || 'Invocation') }; }) };
  } catch (error) {
    return { state: 'error', detail: error instanceof Error ? sanitizeLog(error.message) : 'Lecture des logs indisponible', rows: [] };
  }
}
