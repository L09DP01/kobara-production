import 'server-only';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { answerWhatsAppSupport, type AssistantResult } from '@/lib/server/whatsapp/assistant';
import { containsPotentialSecret, redactSecrets } from '@/lib/server/whatsapp/security';
import { composeSupportReply, DOCS_ASSISTANT_URL, isSensitiveSupportRequest, needsCodingSupport, sensitiveSupportHandoff, secretSupportWarning, supportIntent } from '@/lib/support-assistant-policy';
import { aiChatLimiter } from '@/lib/server/security/rate-limit';
import { createHash } from 'node:crypto';

const htmlText = (text: string) => `<p style="white-space:pre-wrap">${text.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!))}</p>`;

export function scheduleSupportFirstReply(ticketId: string) {
  if (process.env.SUPPORT_AI_ENABLED === 'false') return;
  after(async () => {
    try { await replyToSupportTicket(ticketId); }
    catch { console.error('[SupportAssistant] First reply failed; ticket remains in the human queue.', { ticketId }); }
  });
}

export function schedulePendingSupportReplies() {
  if (process.env.SUPPORT_AI_ENABLED === 'false') return;
  after(async () => {
    const { data, error } = await createAdminClient().rpc('pending_support_first_reply_ids');
    if (error) { console.error('[SupportAssistant] Pending queue unavailable.'); return; }
    for (const ticket of (data || []) as { id: string }[]) {
      try { await replyToSupportTicket(ticket.id); }
      catch { console.error('[SupportAssistant] Pending reply failed.', { ticketId: ticket.id }); }
    }
  });
}

export async function replyToSupportTicket(ticketId: string) {
  if (process.env.SUPPORT_AI_ENABLED === 'false') return;
  const admin = createAdminClient();
  const { data: ticket, error: ticketError } = await admin.from('support_tickets')
    .select('id,public_id,subject,source,status,assigned_admin_id,requester_email')
    .eq('id', ticketId).maybeSingle();
  if (ticketError) throw new Error('support_ticket_unavailable');
  if (!ticket || ticket.status === 'closed' || ticket.source === 'whatsapp' || ticket.assigned_admin_id) return;

  const { data: messages, error: historyError } = await admin.from('ticket_messages')
    .select('sender_type,message').eq('ticket_id', ticketId).order('created_at', { ascending: true }).limit(20);
  if (historyError) throw new Error('support_history_unavailable');
  if (!messages?.length || messages.some((message) => ['admin', 'assistant'].includes(message.sender_type))) return;
  const rawQuestion = `${ticket.subject}\n${messages[0].message}`;
  const secretDetected = containsPotentialSecret(rawQuestion);
  const sensitiveRequest = isSensitiveSupportRequest(rawQuestion);
  const question = redactSecrets(rawQuestion).slice(0, 9000);
  const identity = createHash('sha256').update(ticket.requester_email || ticketId).digest('hex');
  const budget = await aiChatLimiter.limit(`support-first:${identity}`);
  const result: AssistantResult = budget.success && !sensitiveRequest && !secretDetected ? await answerWhatsAppSupport({
    channel: 'support', question,
    history: messages.map((message) => ({ sender_type: message.sender_type, body: String(message.message).slice(0, 1500) })),
  }) : { answer: '', references: [], shouldOfferHuman: true, model: null };
  const reply = composeSupportReply(question, ticket.public_id || ticket.id, result);
  const handoff = sensitiveRequest || secretDetected || reply.handoff;
  const answer = `${secretDetected ? secretSupportWarning(question) : ''}${sensitiveRequest ? sensitiveSupportHandoff(question, ticket.public_id || ticket.id) : redactSecrets(reply.answer)}`.slice(0, 4000);
  const citedReferences = result.answerIsGrounded && !sensitiveRequest && !secretDetected ? result.references : [];
  const supportReferences = needsCodingSupport(question) && !sensitiveRequest && !secretDetected
    ? [{ title: 'Kobara AI : aide au code', url: DOCS_ASSISTANT_URL }, ...citedReferences.filter((reference) => reference.url !== DOCS_ASSISTANT_URL)]
    : citedReferences;

  // Atomic persistence prevents duplicate replies and respects a human takeover during generation.
  const { data: messageId, error } = await admin.rpc('record_support_first_reply', {
    p_ticket_id: ticketId, p_message: answer, p_handoff: handoff,
    p_metadata: { model: result.model, intent: supportIntent(question), references: supportReferences.map(({ title, url }) => ({ title, url })), public_sources_checked: !sensitiveRequest && !secretDetected && budget.success, sensitive_request: sensitiveRequest },
  });
  if (error) throw new Error('support_reply_not_saved');
  if (!messageId) return;
  revalidatePath(`/system-core/support/${ticketId}`);
  revalidatePath('/system-core/support');

  let clientDeliveryFailed = false;
  if (ticket.requester_email) {
    const delivery = await sendEmail({
      to: ticket.requester_email, subject: `[${ticket.public_id}] Assistance Kobara`,
      text: answer, html: htmlText(answer), replyTo: 'support@kobara.app', idempotencyKey: `support-first-reply-${messageId}`,
    });
    if (!delivery.success) {
      clientDeliveryFailed = true;
      await admin.from('support_tickets').update({ status: 'pending_admin' }).eq('id', ticketId).eq('status', 'pending_merchant');
      console.error('[SupportAssistant] Client reply email not delivered.', { ticketId });
    }
  }
  if (handoff || clientDeliveryFailed) {
    const summary = `Demande ${ticket.public_id} en attente de l’équipe Kobara (${supportIntent(question)}).\n\n${question.slice(0, 1500)}\n\nOuvrir : https://kobara.app/system-core/support/${ticketId}`;
    await sendEmail({
      to: process.env.SUPPORT_AI_ALERT_EMAIL || process.env.SUPPORT_EMAIL || 'support@kobara.app',
      subject: `[${ticket.public_id}] Suivi humain requis`, text: summary, html: htmlText(summary),
      idempotencyKey: `support-handoff-${messageId}`,
    });
  }
}
