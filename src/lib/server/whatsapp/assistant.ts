import 'server-only';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type CoreMessage } from 'ai';
import { createAdminClient } from '@/utils/supabase/admin';
import { formatKnowledgeContext, searchKobaraKnowledge, type KnowledgeReference } from './knowledge';
import { containsPotentialSecret, isSupportRelated, redactSecrets } from './security';

type AssistantInput = {
  question: string;
  history: Array<{ sender_type: string; body: string | null }>;
  memorySummary?: string | null;
  accountContext?: string | null;
  image?: { bytes: Uint8Array; mimeType: string } | null;
};

export type AssistantResult = {
  answer: string;
  references: KnowledgeReference[];
  shouldOfferHuman: boolean;
  model: string | null;
};

function safeOperationalMetadata(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed = new Set(['status', 'error', 'error_code', 'code', 'reason', 'failure_reason', 'provider', 'environment', 'response_status', 'retry_count']);
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key, item]) => allowed.has(key) && ['string', 'number', 'boolean'].includes(typeof item)));
}

const HUMAN_REQUEST = /(agent|humain|moun reyèl|moun reel|équipe technique|equipe technique|technicien|konseye|conseiller|support humain)/i;

export async function buildSafeMerchantDiagnostic(merchantId: string) {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [merchantResult, paymentsResult, withdrawalsResult, webhooksResult, logsResult, auditResult] = await Promise.all([
    admin.from('merchants').select('business_name,status,kyc_status,plan_slug,plan_status,account_access,current_environment').eq('id', merchantId).maybeSingle(),
    admin.from('payments').select('kobara_reference,status,provider,created_at,paid_at').eq('merchant_id', merchantId).gte('created_at', since).order('created_at', { ascending: false }).limit(5),
    admin.from('withdrawals').select('kobara_reference,status,provider,failed_reason,created_at,completed_at').eq('merchant_id', merchantId).gte('created_at', since).order('created_at', { ascending: false }).limit(5),
    admin.from('webhook_events').select('event_type,delivery_status,response_status,retry_count,created_at').eq('merchant_id', merchantId).gte('created_at', since).order('created_at', { ascending: false }).limit(5),
    admin.from('support_system_logs').select('level,source,event_type,message,created_at').eq('merchant_id', merchantId).gte('created_at', since).order('created_at', { ascending: false }).limit(8),
    admin.from('audit_logs').select('action,entity_type,metadata,created_at').eq('merchant_id', merchantId).gte('created_at', since).order('created_at', { ascending: false }).limit(12),
  ]);

  const merchant = merchantResult.data;
  if (!merchant) return 'Aucun compte marchand vérifié ne correspond à cette identité.';
  const lines = [
    `Compte: ${merchant.business_name}; statut=${merchant.status}; KYC=${merchant.kyc_status}; plan=${merchant.plan_slug}/${merchant.plan_status}; accès=${merchant.account_access}; environnement=${merchant.current_environment}.`,
    `Paiements récents: ${JSON.stringify(paymentsResult.data || [])}.`,
    `Retraits récents: ${JSON.stringify(withdrawalsResult.data || [])}.`,
    `Livraisons webhook récentes: ${JSON.stringify(webhooksResult.data || [])}.`,
    `Journaux support sûrs: ${JSON.stringify(logsResult.data || [])}.`,
    `Événements système récents: ${JSON.stringify((auditResult.data || []).map((event) => ({ action: event.action, entity_type: event.entity_type, created_at: event.created_at, metadata: safeOperationalMetadata(event.metadata) })))}.`,
  ];
  return redactSecrets(lines.join('\n')).slice(0, 7000);
}

export async function answerWhatsAppSupport(input: AssistantInput): Promise<AssistantResult> {
  if (HUMAN_REQUEST.test(input.question)) {
    return { answer: '', references: [], shouldOfferHuman: true, model: null };
  }

  const references = searchKobaraKnowledge(input.question, 5);
  const hasSupportContext = isSupportRelated(input.question) || references.length > 0 || Boolean(input.accountContext) || Boolean(input.image);
  if (!hasSupportContext) {
    return {
      answer: "Je peux vous aider uniquement avec Kobara, ses paiements, votre compte ou son intégration. Avez-vous une question liée au support Kobara ?",
      references: [],
      shouldOfferHuman: false,
      model: null,
    };
  }

  if (!references.length && !input.accountContext && !input.image) {
    return {
      answer: "Je ne trouve pas de référence Kobara fiable pour répondre sans supposer. Souhaitez-vous que je transmette votre demande à l’équipe technique ?",
      references: [],
      shouldOfferHuman: true,
      model: null,
    };
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return {
      answer: "Le service de réponse est momentanément indisponible. Souhaitez-vous que je transmette votre demande à l’équipe technique ?",
      references,
      shouldOfferHuman: true,
      model: null,
    };
  }

  const modelName = process.env.WHATSAPP_AI_MODEL || 'gemini-2.5-flash';
  const google = createGoogleGenerativeAI({ apiKey });
  const history = input.history.slice(-10).map((message) => `${message.sender_type}: ${redactSecrets(message.body || '')}`).join('\n');
  const system = `Tu es l'assistante de support Kobara sur WhatsApp. Tu sembles humaine, calme, sage et gentille, mais tu ne prétends jamais être une personne précise. Ne répète pas que tu es une IA.

RÈGLES STRICTES:
- Réponds dans la langue du dernier message: français, kreyòl ayisyen ou anglais. Adapte naturellement le ton et le vocabulaire.
- Réponse courte et précise: 2 à 6 phrases, sauf étapes de débogage réellement nécessaires.
- Utilise uniquement les SOURCES KOBARA et le CONTEXTE COMPTE fournis. Ne complète jamais avec une supposition.
- Si l'information manque ou se contredit, dis-le puis propose l'équipe technique.
- Une page de succès navigateur n'est pas une preuve serveur; respecte la documentation des webhooks.
- Ne demande jamais une clé API, un mot de passe, un OTP, un PIN ou un secret webhook.
- Si une capture semble montrer une clé ou un secret, ne le recopie pas: demande sa révocation immédiate et la création d'une nouvelle clé.
- N'expose ni logs bruts, ni stack trace, ni données d'un autre client. Explique seulement la cause utile et l'action sûre.
- Refuse poliment les sujets sans rapport avec le support Kobara et les demandes de données personnelles.
- Termine une réponse technique par au maximum deux liens provenant exactement des SOURCES.
- La première ligne doit être exactement SAFETY_SECRET_DETECTED: true si l'image semble montrer une clé API, un bearer token, un mot de passe ou un secret; sinon SAFETY_SECRET_DETECTED: false. Ne recopie jamais le secret.

SOURCES KOBARA:
${formatKnowledgeContext(references) || 'Aucune source publique trouvée.'}

MÉMOIRE CLIENT:
${input.memorySummary || 'Aucune mémoire enregistrée.'}

CONTEXTE COMPTE VÉRIFIÉ ET JOURNAUX SANITISÉS:
${input.accountContext || 'Identité du compte non vérifiée; ne révèle aucune information de compte.'}`;

  const userContent: CoreMessage['content'] = input.image
    ? [
        { type: 'text', text: `Historique récent:\n${history}\n\nQuestion actuelle: ${redactSecrets(input.question || 'Analyse cette capture pour résoudre le problème Kobara.')}` },
        { type: 'image', image: input.image.bytes, mimeType: input.image.mimeType },
      ]
    : `Historique récent:\n${history}\n\nQuestion actuelle: ${redactSecrets(input.question)}`;

  try {
    const { text } = await generateText({
      model: google(modelName),
      system,
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.15,
      maxTokens: 550,
    });
    const secretMarker = /^SAFETY_SECRET_DETECTED:\s*true\s*$/im.test(text);
    let answer = redactSecrets(text.replace(/^SAFETY_SECRET_DETECTED:\s*(?:true|false)\s*$/im, '').trim());
    if (secretMarker || containsPotentialSecret(text)) {
      answer = "Cette capture semble contenir une clé ou un secret. Révoquez-le immédiatement dans Kobara, créez-en un nouveau et ne le partagez pas dans une conversation. Je peux ensuite vous aider avec une capture où le secret est masqué.";
    }
    return { answer, references, shouldOfferHuman: /équipe technique|equipe technique|technical team|ekip teknik/i.test(answer), model: modelName };
  } catch (error) {
    console.error('[WhatsAppAssistant] Generation failed:', error);
    return {
      answer: "Je n’ai pas pu vérifier la réponse correctement. Souhaitez-vous que je transmette votre demande à l’équipe technique Kobara ?",
      references,
      shouldOfferHuman: true,
      model: modelName,
    };
  }
}
