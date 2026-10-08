import 'server-only';

import { randomInt } from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { createSupportConversation } from '@/lib/server/support/tickets';
import { answerWhatsAppSupport, buildSafeMerchantDiagnostic } from './assistant';
import { downloadWhatsAppMedia, markWhatsAppMessageRead, sendWhatsAppText } from './client';
import { containsPotentialSecret, extractEmail, hashVerificationCode, normalizePhone, redactSecrets } from './security';

type IncomingMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

type WebhookValue = {
  contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
  messages?: IncomingMessage[];
  statuses?: Array<{ id?: string; status?: string; timestamp?: string; errors?: unknown[] }>;
};

const ACCOUNT_PROBLEM = /(mon compte|my account|kont mwen|connexion|login|suspend|kyc|plan|abonnement|solde|balance|retrait|withdraw|retrè|transaction|paiement.*(échou|failed|pending|attente)|webhook.*(échou|failed|405|error|erreur))/i;
const YES = /^(oui|wi|yes|d'accord|dak[oò]|ok|okay|transf[eè]re|pale ak yo|agent)$/i;
const HUMAN = /(agent humain|support humain|équipe technique|equipe technique|moun reyèl|moun reel|ekip teknik|technical team)/i;
const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

async function logSupportEvent(input: {
  conversationId?: string | null;
  merchantId?: string | null;
  level?: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  eventType: string;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from('support_system_logs').insert({
    conversation_id: input.conversationId || null,
    merchant_id: input.merchantId || null,
    level: input.level || 'info',
    source: input.source,
    event_type: input.eventType,
    message: redactSecrets(input.message).slice(0, 1200),
    metadata: input.metadata || {},
  });
}

async function getOrCreateContact(phone: string, displayName?: string | null) {
  const admin = createAdminClient();
  const { data: existing } = await admin.from('whatsapp_contacts').select('*').eq('phone_e164', phone).maybeSingle();
  if (existing) {
    const updates = { last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...(displayName ? { display_name: displayName } : {}) };
    await admin.from('whatsapp_contacts').update(updates).eq('id', existing.id);
    return { ...existing, ...updates };
  }
  const { data, error } = await admin.from('whatsapp_contacts').insert({ phone_e164: phone, display_name: displayName || null }).select('*').single();
  if (error || !data) throw new Error(error?.message || 'Unable to create WhatsApp contact');
  return data;
}

async function getOrCreateConversation(contact: Record<string, any>) {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from('whatsapp_conversations')
    .select('*')
    .eq('contact_id', contact.id)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const isRecent = current && Date.now() - new Date(current.last_message_at).getTime() < FIVE_DAYS_MS;
  if (current && isRecent && current.status !== 'closed') return current;

  const { data, error } = await admin.from('whatsapp_conversations').insert({
    contact_id: contact.id,
    summary: contact.memory_summary || current?.summary || null,
  }).select('*').single();
  if (error || !data) throw new Error(error?.message || 'Unable to create WhatsApp conversation');
  return data;
}

async function storeMessage(input: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('whatsapp_messages').insert(input).select('id').single();
  if (error && error.code !== '23505') throw new Error(error.message);
  return data;
}

async function sendAndStore(conversationId: string, phone: string, body: string, senderType: 'assistant' | 'admin' | 'system', sources: unknown[] = [], model?: string | null) {
  let providerMessageId: string | null = null;
  try {
    providerMessageId = (await sendWhatsAppText(phone, body)).messageId;
  } catch (error) {
    await logSupportEvent({ conversationId, level: 'error', source: 'whatsapp', eventType: 'message.send_failed', message: error instanceof Error ? error.message : 'Send failed' });
    throw error;
  }
  await storeMessage({
    conversation_id: conversationId,
    provider_message_id: providerMessageId,
    direction: 'outbound',
    sender_type: senderType,
    message_type: 'text',
    body,
    delivery_status: 'sent',
    knowledge_sources: sources,
    model: model || null,
  });
}

async function beginEmailVerification(contact: Record<string, any>, conversation: Record<string, any>, email: string) {
  const admin = createAdminClient();
  const { data: merchant } = await admin.from('merchants').select('id,business_name').ilike('email', email).limit(1).maybeSingle();
  const genericReply = "Si cette adresse correspond à un compte Kobara, un code de vérification vient d’être envoyé. Envoyez simplement les 6 chiffres ici. Le code expire dans 10 minutes.";
  if (!merchant) {
    await logSupportEvent({ conversationId: conversation.id, level: 'warning', source: 'identity', eventType: 'email.not_matched', message: 'A merchant email verification was requested for an address not linked to a merchant.' });
    return genericReply;
  }

  const code = String(randomInt(100000, 1000000));
  await admin.from('whatsapp_identity_challenges').insert({
    contact_id: contact.id,
    email,
    code_hash: hashVerificationCode(code),
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  await sendEmail({
    to: email,
    subject: 'Code de vérification Support Kobara',
    text: `Votre code de vérification pour la conversation WhatsApp Kobara est ${code}. Il expire dans 10 minutes. Si vous n’avez pas demandé ce code, ignorez cet e-mail.`,
  });
  await admin.from('whatsapp_contacts').update({ email, updated_at: new Date().toISOString() }).eq('id', contact.id);
  return genericReply;
}

async function verifyEmailCode(contact: Record<string, any>, code: string) {
  const admin = createAdminClient();
  const { data: challenge } = await admin
    .from('whatsapp_identity_challenges')
    .select('*')
    .eq('contact_id', contact.id)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now() || challenge.attempts >= 5) return null;
  if (challenge.code_hash !== hashVerificationCode(code)) {
    await admin.from('whatsapp_identity_challenges').update({ attempts: challenge.attempts + 1 }).eq('id', challenge.id);
    return false;
  }
  const { data: merchant } = await admin.from('merchants').select('id,business_name,email').ilike('email', challenge.email).limit(1).maybeSingle();
  if (!merchant) return null;
  const now = new Date().toISOString();
  await Promise.all([
    admin.from('whatsapp_identity_challenges').update({ consumed_at: now }).eq('id', challenge.id),
    admin.from('whatsapp_contacts').update({ email: challenge.email, email_verified_at: now, merchant_id: merchant.id, updated_at: now }).eq('id', contact.id),
  ]);
  return merchant;
}

async function handoffToHuman(contact: Record<string, any>, conversation: Record<string, any>, summary: string) {
  if (!contact.email) return { needsEmail: true as const };
  const admin = createAdminClient();
  const result = await createSupportConversation({
    merchantId: contact.merchant_id,
    requesterName: contact.display_name,
    requesterEmail: contact.email,
    recipientEmail: 'support@kobara.app',
    subject: `Assistance WhatsApp — ${contact.display_name || contact.phone_e164}`,
    category: 'whatsapp_support',
    priority: 'normal',
    message: summary.slice(0, 9000),
    source: 'whatsapp',
    metadata: { conversation_id: conversation.id, phone_last4: contact.phone_e164.slice(-4) },
  });
  const pausedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await admin.from('whatsapp_conversations').update({ ticket_id: result.ticketId, status: 'human', ai_paused_until: pausedUntil, summary, updated_at: new Date().toISOString() }).eq('id', conversation.id);
  await sendEmail({
    to: process.env.WHATSAPP_SUPPORT_ALERT_EMAIL || 'support@kobara.app',
    subject: `[${result.publicId}] Client WhatsApp en attente`,
    text: `Une conversation WhatsApp a été transférée au support humain.\n\nClient : ${contact.display_name || 'Non renseigné'}\nE-mail vérifié : ${contact.email_verified_at ? contact.email : 'non vérifié'}\nRésumé : ${summary}\n\nOuvrir : ${(process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app')}/system-core/whatsapp?conversation=${conversation.id}`,
  });
  await logSupportEvent({ conversationId: conversation.id, merchantId: contact.merchant_id, source: 'handoff', eventType: 'ticket.created', message: `Ticket ${result.publicId} created; AI paused for 12 hours.`, metadata: { ticket_id: result.ticketId, public_id: result.publicId } });
  return { needsEmail: false as const, publicId: result.publicId, pausedUntil };
}

function incomingBody(message: IncomingMessage) {
  return message.text?.body
    || message.image?.caption
    || message.document?.caption
    || message.interactive?.button_reply?.title
    || message.interactive?.list_reply?.title
    || (message.type === 'image' ? 'Capture d’écran envoyée pour analyse.' : `[${message.type}]`);
}

export async function processWhatsAppWebhook(payload: Record<string, any>) {
  const values: WebhookValue[] = (payload.entry || []).flatMap((entry: any) => (entry.changes || []).map((change: any) => change.value || {}));
  const admin = createAdminClient();

  for (const value of values) {
    for (const status of value.statuses || []) {
      if (status.id) await admin.from('whatsapp_messages').update({ delivery_status: status.status || 'unknown', metadata: { status_errors: status.errors || [] } }).eq('provider_message_id', status.id);
    }

    for (const message of value.messages || []) {
      const phone = normalizePhone(message.from);
      if (!phone || !message.id) continue;
      const contactProfile = value.contacts?.find((item) => normalizePhone(item.wa_id || '') === phone);
      const contact = await getOrCreateContact(phone, contactProfile?.profile?.name);
      const conversation = await getOrCreateConversation(contact);
      const body = redactSecrets(incomingBody(message));
      const inserted = await storeMessage({
        conversation_id: conversation.id,
        provider_message_id: message.id,
        direction: 'inbound',
        sender_type: 'customer',
        message_type: ['text', 'image', 'document', 'interactive'].includes(message.type) ? message.type : 'text',
        body,
        media_id: message.image?.id || message.document?.id || null,
        mime_type: message.image?.mime_type || message.document?.mime_type || null,
        delivery_status: 'received',
        metadata: { provider_timestamp: message.timestamp || null },
      });
      if (!inserted) continue;

      const now = new Date().toISOString();
      await admin.from('whatsapp_conversations').update({ last_message_at: now, last_inbound_at: now, updated_at: now }).eq('id', conversation.id);
      markWhatsAppMessageRead(message.id).catch(() => undefined);

      const pauseExpiresAt = conversation.ai_paused_until ? new Date(conversation.ai_paused_until).getTime() : null;
      const aiPaused = Boolean(pauseExpiresAt && pauseExpiresAt > Date.now());
      if (conversation.status === 'human' && pauseExpiresAt && pauseExpiresAt <= Date.now()) {
        await admin.from('whatsapp_conversations').update({ status: 'open', ai_paused_until: null, updated_at: now }).eq('id', conversation.id);
        conversation.status = 'open';
        conversation.ai_paused_until = null;
      }
      if (aiPaused || conversation.status === 'human') continue;

      if (containsPotentialSecret(incomingBody(message))) {
        const warning = "Ce message semble contenir une clé ou un secret. Révoquez-le immédiatement dans Kobara, créez-en un nouveau et ne partagez jamais la nouvelle valeur ici. Pour continuer, envoyez une version où le secret est entièrement masqué.";
        await sendAndStore(conversation.id, phone, warning, 'assistant');
        await logSupportEvent({ conversationId: conversation.id, merchantId: contact.merchant_id, level: 'critical', source: 'security', eventType: 'secret.detected', message: 'A potential secret was detected and redacted from a WhatsApp message.' });
        continue;
      }

      if (/^\d{6}$/.test(body.trim())) {
        const verified = await verifyEmailCode(contact, body.trim());
        const reply = verified
          ? `Merci, votre identité est vérifiée pour ${verified.business_name}. Décrivez le problème ou envoyez la référence Kobara concernée; ne partagez aucune clé API.`
          : verified === false
            ? "Ce code n’est pas valide. Vérifiez les 6 chiffres reçus par e-mail."
            : "Ce code a expiré ou n’est plus valide. Envoyez de nouveau votre e-mail pour recevoir un nouveau code.";
        await sendAndStore(conversation.id, phone, reply, 'assistant');
        continue;
      }

      const email = extractEmail(body);
      if (email && !contact.email_verified_at) {
        await sendAndStore(conversation.id, phone, await beginEmailVerification(contact, conversation, email), 'assistant');
        continue;
      }

      const { data: recentMessages } = await admin.from('whatsapp_messages').select('sender_type,body').eq('conversation_id', conversation.id).order('created_at', { ascending: true }).limit(20);
      const previousAssistant = [...(recentMessages || [])].reverse().find((item) => item.sender_type === 'assistant')?.body || '';
      const wantsHuman = HUMAN.test(body) || (YES.test(body.trim()) && /équipe technique|equipe technique|technical team|ekip teknik/i.test(previousAssistant));
      if (wantsHuman) {
        if (!contact.email) {
          await sendAndStore(conversation.id, phone, "Pour ouvrir le ticket et retrouver votre compte en sécurité, quelle est l’adresse e-mail utilisée sur Kobara ? Je ne vous demanderai jamais votre mot de passe ni votre clé API.", 'assistant');
          continue;
        }
        const summary = (recentMessages || []).slice(-12).map((item) => `${item.sender_type}: ${item.body || ''}`).join('\n');
        const handoff = await handoffToHuman(contact, conversation, summary);
        if (!handoff.needsEmail) await sendAndStore(conversation.id, phone, `Votre demande est transmise à l’équipe Kobara sous la référence ${handoff.publicId}. Une personne vous répondra ici. Les réponses automatiques sont suspendues pendant 12 heures.`, 'system');
        continue;
      }

      if (ACCOUNT_PROBLEM.test(body) && !contact.email_verified_at) {
        await sendAndStore(conversation.id, phone, "Je peux vérifier le compte, mais je dois d’abord confirmer votre identité. Quelle adresse e-mail utilisez-vous sur Kobara ? Un code de 6 chiffres sera envoyé à cette adresse. Ne partagez ni mot de passe ni clé API.", 'assistant');
        continue;
      }

      let image: { bytes: Uint8Array; mimeType: string } | null = null;
      if (message.type === 'image' && message.image?.id) {
        try {
          image = await downloadWhatsAppMedia(message.image.id);
        } catch (error) {
          await logSupportEvent({ conversationId: conversation.id, merchantId: contact.merchant_id, level: 'error', source: 'media', eventType: 'image.download_failed', message: error instanceof Error ? error.message : 'Image download failed' });
        }
      }

      const accountContext = contact.email_verified_at && contact.merchant_id ? await buildSafeMerchantDiagnostic(contact.merchant_id) : null;
      const result = await answerWhatsAppSupport({
        question: body,
        history: recentMessages || [],
        memorySummary: contact.memory_summary || conversation.summary,
        accountContext,
        image,
      });
      if (!result.answer && result.shouldOfferHuman) {
        const handoff = await handoffToHuman(contact, conversation, (recentMessages || []).slice(-12).map((item) => `${item.sender_type}: ${item.body || ''}`).join('\n'));
        if (handoff.needsEmail) await sendAndStore(conversation.id, phone, "Je peux transmettre votre demande à l’équipe technique. Indiquez d’abord l’adresse e-mail utilisée sur Kobara pour ouvrir le ticket.", 'assistant');
        else await sendAndStore(conversation.id, phone, `Votre demande est transmise à l’équipe Kobara sous la référence ${handoff.publicId}. Une personne vous répondra ici.`, 'system');
        continue;
      }
      await sendAndStore(conversation.id, phone, result.answer, 'assistant', result.references.map(({ title, url }) => ({ title, url })), result.model);
      await logSupportEvent({ conversationId: conversation.id, merchantId: contact.merchant_id, source: 'assistant', eventType: 'answer.generated', message: 'A grounded WhatsApp support answer was generated.', metadata: { source_urls: result.references.map((reference) => reference.url), model: result.model } });
    }
  }
}

export async function sendAdminWhatsAppMessage(conversationId: string, body: string) {
  const admin = createAdminClient();
  const { data: conversation } = await admin.from('whatsapp_conversations').select('*, whatsapp_contacts(*)').eq('id', conversationId).single();
  if (!conversation?.whatsapp_contacts?.phone_e164) throw new Error('Conversation WhatsApp introuvable');
  await sendAndStore(conversationId, conversation.whatsapp_contacts.phone_e164, body, 'admin');
  await admin.from('whatsapp_conversations').update({ status: 'human', ai_paused_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(), last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', conversationId);
}

export async function setConversationAiState(conversationId: string, enabled: boolean) {
  const admin = createAdminClient();
  await admin.from('whatsapp_conversations').update({
    status: enabled ? 'open' : 'human',
    ai_paused_until: enabled ? null : new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId);
}
