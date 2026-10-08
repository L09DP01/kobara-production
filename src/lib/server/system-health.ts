import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';

export type HealthCheck = { name: string; state: 'ok' | 'error' | 'unconfigured' | 'unchecked'; detail: string };

async function probe(name: string, url: string, headers?: Record<string, string>): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(6000), redirect: 'error' });
    return { name, state: response.ok ? 'ok' : 'error', detail: `HTTP ${response.status} · ${Date.now() - started} ms` };
  } catch { return { name, state: 'error', detail: 'Connexion impossible ou délai dépassé' }; }
}

export async function getSystemHealthChecks(): Promise<HealthCheck[]> {
  const admin = createAdminClient();
  const checks = await Promise.all(['payments', 'subscriptions', 'support_tickets', 'whatsapp_contacts', 'whatsapp_conversations', 'whatsapp_messages', 'support_system_logs', 'webhook_events'].map(async table => {
    try {
      const started = Date.now();
      const { error } = await admin.from(table).select('id').limit(1).abortSignal(AbortSignal.timeout(6000));
      return { name: `Base · ${table}`, state: error ? 'error' : 'ok', detail: error ? 'Table inaccessible' : `Lecture disponible · ${Date.now() - started} ms` } as HealthCheck;
    } catch { return { name: `Base · ${table}`, state: 'error', detail: 'Lecture impossible ou délai dépassé' } as HealthCheck; }
  }));
  const remote: Promise<HealthCheck>[] = [];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(supabaseUrl)) remote.push(probe('Supabase Auth', `${supabaseUrl}/auth/v1/health`, { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '' }));
  const redis = process.env.UPSTASH_REDIS_REST_URL;
  if (redis && /^https:\/\/[a-z0-9-]+\.upstash\.io$/.test(redis) && process.env.UPSTASH_REDIS_REST_TOKEN) remote.push((async () => {
    try {
      const response = await fetch(`${redis}/ping`, { headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }, cache: 'no-store', signal: AbortSignal.timeout(6000) });
      const data = await response.json();
      return { name: 'Redis', state: response.ok && data.result === 'PONG' ? 'ok' : 'error', detail: response.ok && data.result === 'PONG' ? 'PING confirmé' : 'PING échoué' } as HealthCheck;
    } catch { return { name: 'Redis', state: 'error', detail: 'PING indisponible' } as HealthCheck; }
  })());
  else checks.push({ name: 'Redis', state: 'unconfigured', detail: 'Connexion Redis non configurée' });
  const whatsappReady = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN', 'WHATSAPP_VERIFICATION_PEPPER'].every(key => Boolean(process.env[key]));
  if (whatsappReady && /^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID!) && /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0')) remote.push(probe('WhatsApp Meta', `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v26.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id`, { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` }));
  else checks.push({ name: 'WhatsApp Meta', state: 'unconfigured', detail: 'Paramètres WhatsApp incomplets' });
  for (const [name, configured] of [
    ['Logs Supabase', Boolean(process.env.SUPABASE_MANAGEMENT_TOKEN && process.env.SUPABASE_PROJECT_REF)],
    ['Logs Cloudflare', Boolean(process.env.CLOUDFLARE_OBSERVABILITY_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_LOG_QUERY_ID)],
    ['IA support', Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY)],
    ['Telegram', Boolean(process.env.TELEGRAM_BOT_TOKEN)],
    ['Envoi e-mail', Boolean(process.env.RESEND_API_KEY)],
    ['PayPal', Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)],
    ['Crypto', Boolean(process.env.NOWPAYMENTS_API_KEY)],
  ] as const) checks.push({ name, state: configured ? 'unchecked' : 'unconfigured', detail: configured ? 'Configuré · disponibilité non testée' : 'Non configuré' });
  return [...checks, ...await Promise.all(remote)];
}
