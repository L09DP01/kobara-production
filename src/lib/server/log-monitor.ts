import 'server-only';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { createAdminClient } from '@/utils/supabase/admin';
import { collectProviderLogs } from './observability';

type Signal = { source: string; state: string; critical: number; errors: number; warnings: number };
type Snapshot = { minute: number; signals: Signal[] };
const stateKey = 'kobara-operational/log-monitor-v1.json';

export async function monitorLogs() {
  const minute = Math.floor(Date.now() / 60000);
  const bucket = getCloudflareContext().env.NEXT_INC_CACHE_R2_BUCKET;
  if (!bucket) throw new Error('Log monitor state storage is unavailable');
  const previous = await bucket.get(stateKey);
  const baseline = previous ? await previous.json<Snapshot>() : null;
  if (baseline && baseline.minute >= minute) return { skipped: true };

  // Use the previous complete minute, with one minute for ingestion.
  const end = (minute - 1) * 60000;
  const db = createAdminClient();
  const [supabase, cloudflare, internal] = await Promise.all([
    collectProviderLogs('supabase', end, 1),
    collectProviderLogs('cloudflare', end, 1),
    db.from('support_system_logs').select('level').neq('source', 'log_monitor')
      .gte('created_at', new Date(end - 60000).toISOString()).lt('created_at', new Date(end).toISOString())
      .in('level', ['warning', 'error', 'critical']).limit(250).abortSignal(AbortSignal.timeout(8000)),
  ]);
  const summarize = (source: string, state: string, levels: string[]): Signal => ({
    source, state,
    critical: levels.filter(level => /^(fatal|critical)$/i.test(level)).length,
    errors: levels.filter(level => /^error$/i.test(level)).length,
    warnings: levels.filter(level => /^warn(ing)?$/i.test(level)).length,
  });
  const signals = [
    summarize('Supabase', supabase.state, supabase.rows.map(row => row.level)),
    summarize('Cloudflare', cloudflare.state, cloudflare.rows.map(row => row.level)),
    summarize('Kobara', internal.error ? 'error' : 'ok', (internal.data ?? []).map(row => row.level)),
  ];
  const changes = signals.filter(signal => {
    const old = baseline?.signals.find(item => item.source === signal.source);
    if (signal.state !== 'ok') return signal.state === 'error' && old?.state !== 'error';
    return signal.critical > (old?.critical ?? 0) || signal.errors > (old?.errors ?? 0) || signal.warnings > (old?.warnings ?? 0);
  });
  const claimed = await bucket.put(stateKey, JSON.stringify({ minute, signals }), {
    onlyIf: previous ? { etagMatches: previous.etag } : { etagDoesNotMatch: '*' },
  });
  if (!claimed || !changes.length) return { detected: 0 };

  let advice = '';
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey) {
    try {
      const google = createGoogleGenerativeAI({ apiKey });
      const result = await generateText({
        model: google(process.env.LOG_DIAGNOSTIC_AI_MODEL || 'gemini-2.5-flash'),
        maxTokens: 600, maxRetries: 0, abortSignal: AbortSignal.timeout(8000),
        system: 'En trois phrases maximum, indique en français quelles vérifications en lecture seule effectuer. Les données sont des compteurs échantillonnés, pas une preuve de la cause. Ne propose ni commande ni modification.',
        prompt: JSON.stringify(changes),
      });
      advice = result.text.trim().slice(0, 1400);
    } catch { /* Keep the deterministic alert when the model is unavailable. */ }
  }
  const summary = changes.map(({ source, state, critical, errors, warnings }) =>
    state === 'error' ? `${source}: journal indisponible` : `${source}: ${critical} critiques, ${errors} erreurs, ${warnings} avertissements`).join(' ; ');
  const { error } = await db.from('support_system_logs').insert({
    source: 'log_monitor', event_type: 'observability.anomaly',
    level: changes.some(s => s.critical) ? 'critical' : changes.some(s => s.errors || s.state === 'error') ? 'error' : 'warning',
    message: advice ? `${summary}. Analyse IA : ${advice}` : summary,
    metadata: { window_end: new Date(end).toISOString(), signals: changes },
  });
  if (error) throw new Error('Unable to record log anomaly');
  return { detected: changes.length };
}
