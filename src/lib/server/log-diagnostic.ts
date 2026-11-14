import 'server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { aiChatLimiter } from '@/lib/server/security/rate-limit';
import { readProviderLogs } from './observability';

export async function diagnoseLogs(adminId: string, internal: { level: string; created_at: string }[] | null) {
  const results = await Promise.all([readProviderLogs('supabase'), readProviderLogs('cloudflare')]);
  const summarize = (source: string, state: string, levels: string[]) => ({
    source, state, sampled: levels.length,
    critical: levels.filter(level => /^(critical|fatal)$/i.test(level)).length,
    errors: levels.filter(level => /^error$/i.test(level)).length,
    warnings: levels.filter(level => /^warn(ing)?$/i.test(level)).length,
  });
  const signals = [
    summarize('Kobara', internal ? 'ok' : 'error', (internal ?? [])
      .filter(row => Date.parse(row.created_at) >= Date.now() - 3600000).map(row => row.level)),
    ...results.map((result, i) => summarize(i === 0 ? 'Supabase' : 'Cloudflare', result.state, result.rows.map(row => row.level))),
  ];
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  let advice = '';
  if (apiKey && signals.some(s => s.state !== 'ok' || s.errors || s.critical || s.warnings)) {
    try {
      const budget = await aiChatLimiter.limit(`log-diagnostic:${adminId}`);
      if (budget.success) {
        const google = createGoogleGenerativeAI({ apiKey });
        const result = await generateText({
          model: google(process.env.LOG_DIAGNOSTIC_AI_MODEL || 'gemini-2.5-flash'),
          maxTokens: 600,
          abortSignal: AbortSignal.timeout(8000),
          system: 'Résume en français les signaux observés en trois phrases maximum. Les compteurs sont des échantillons. Ne déduis aucune cause certaine. Propose uniquement des vérifications en lecture seule dans le journal concerné. Ne propose aucune modification ni commande.',
          prompt: JSON.stringify(signals),
        });
        advice = result.text.trim().slice(0, 1400);
      }
    } catch {
      // Provider health remains visible independently of the model.
    }
  }
  return { signals, advice };
}
