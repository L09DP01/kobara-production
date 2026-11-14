import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { hasSesSmtpConfiguration } from './email/ses-smtp';
import { getRuntimeEnvironmentValue } from './runtime-env';
import { readProviderLogs } from './observability';

export type HealthCheck = { name: string; state: 'ok' | 'error' | 'unconfigured' | 'unchecked'; detail: string };

async function probe(name: string, url: string, headers?: Record<string, string>, body?: object, validate?: (data: any) => boolean): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(6000), redirect: 'manual' });
    const ok = response.ok && (!validate || validate(await response.json()));
    return { name, state: ok ? 'ok' : 'error', detail: ok ? `Réponse confirmée · ${Date.now() - started} ms` : response.ok ? 'Réponse de test inattendue' : `HTTP ${response.status}` };
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
  for (const [provider, name] of [['supabase', 'Logs Supabase'], ['cloudflare', 'Logs Cloudflare']] as const) {
    remote.push(readProviderLogs(provider).then(result => ({
      name, state: result.state, detail: result.state === 'ok' ? `Lecture confirmée · ${result.rows.length} événements` : result.detail,
    })).catch(() => ({ name, state: 'unchecked', detail: 'Contrôle réservé aux administrateurs autorisés à lire les journaux' })));
  }
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  if (telegramToken && /^\d+:[\w-]+$/.test(telegramToken)) {
    remote.push(probe('Telegram', `https://api.telegram.org/bot${telegramToken}/getMe`, undefined, undefined, data => data?.ok === true && data.result?.is_bot === true));
  } else checks.push({ name: 'Telegram', state: telegramToken ? 'error' : 'unconfigured', detail: telegramToken ? 'Format du jeton invalide' : 'Jeton manquant' });
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    remote.push(probe('Gemini', 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      { contents: [{ parts: [{ text: 'Reply only: OK' }] }], generationConfig: { maxOutputTokens: 32, thinkingConfig: { thinkingBudget: 0 } } },
      data => data?.candidates?.some((candidate: any) => candidate.content?.parts?.some((part: any) => typeof part.text === 'string' && part.text.trim())) === true));
  } else checks.push({ name: 'Gemini', state: 'unconfigured', detail: 'Clé serveur manquante' });
  let cloudflareEmailConfigured = false;
  try { cloudflareEmailConfigured = Boolean(getCloudflareContext().env.EMAIL); } catch { /* No Worker binding in Node.js. */ }
  for (const [name, configured] of [
    ['Cloudflare e-mail transactionnel', cloudflareEmailConfigured],
    ['Amazon SES SMTP marketing', hasSesSmtpConfiguration()],
    ['Resend secours', Boolean(getRuntimeEnvironmentValue('RESEND_API_KEY'))],
    ['PayPal', Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)],
    ['Crypto', Boolean(process.env.NOWPAYMENTS_API_KEY)],
  ] as const) checks.push({ name, state: configured ? 'unchecked' : 'unconfigured', detail: configured ? 'À vérifier avec un test de bout en bout' : 'Non configuré' });
  checks.push({ name: 'WhatsApp Kapso', state: process.env.KAPSO_API_KEY ? 'unchecked' : 'unconfigured', detail: process.env.KAPSO_API_KEY ? 'À vérifier avec un message de test' : 'Clé serveur Kapso manquante' });
  return [...checks, ...await Promise.all(remote)];
}
