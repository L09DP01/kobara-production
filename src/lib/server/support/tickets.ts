import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';

export const SUPPORT_RECIPIENTS = new Set([
  'contact@kobara.app',
  'support@kobara.app',
]);

export function isSupportRecipient(value: string) {
  const address = normalizeEmailAddress(value);
  const forwardingAddress = process.env.RESEND_SUPPORT_INBOUND_ADDRESS?.trim().toLowerCase();
  return SUPPORT_RECIPIENTS.has(address) || Boolean(forwardingAddress && address === forwardingAddress);
}

export type SupportTicketSource =
  | 'dashboard'
  | 'public_contact'
  | 'suspended_account'
  | 'inbound_email';

type CreateConversationInput = {
  merchantId?: string | null;
  requesterName?: string | null;
  requesterEmail: string;
  recipientEmail?: string | null;
  subject: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  message: string;
  source: SupportTicketSource;
  externalMessageId?: string | null;
  metadata?: Record<string, unknown>;
};

function requiredText(value: string, label: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} requis`);
  if (normalized.length > maxLength) throw new Error(`${label} trop long`);
  return normalized;
}

export function normalizeEmailAddress(value: string) {
  const bracketMatch = value.match(/<([^<>]+)>/);
  return (bracketMatch?.[1] || value).trim().toLowerCase();
}

export function extractDisplayName(value: string) {
  const bracketIndex = value.lastIndexOf('<');
  if (bracketIndex <= 0) return null;
  const name = value.slice(0, bracketIndex).trim().replace(/^['"]|['"]$/g, '');
  return name || null;
}

export function extractTicketReference(subject: string) {
  return subject.match(/\bKBR[A-Z0-9]{12}\b/i)?.[0]?.toUpperCase() || null;
}

async function resolveMerchantId(email: string, explicitMerchantId?: string | null) {
  if (explicitMerchantId) return explicitMerchantId;
  const admin = createAdminClient();
  const { data } = await admin
    .from('merchants')
    .select('id')
    .ilike('email', email)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

export async function createSupportConversation(input: CreateConversationInput) {
  const requesterEmail = normalizeEmailAddress(input.requesterEmail);
  const subject = requiredText(input.subject, 'Sujet', 255);
  const message = requiredText(input.message, 'Message', 10_000);
  const requesterName = input.requesterName?.trim().slice(0, 160) || null;
  const externalMessageId = input.externalMessageId?.trim().slice(0, 500) || null;
  const admin = createAdminClient();

  if (!/^\S+@\S+\.\S+$/.test(requesterEmail)) {
    throw new Error('Adresse e-mail invalide');
  }

  if (externalMessageId) {
    const { data: existingMessage } = await admin
      .from('ticket_messages')
      .select('ticket_id')
      .eq('external_message_id', externalMessageId)
      .maybeSingle();
    if (existingMessage) {
      return { ticketId: existingMessage.ticket_id, duplicate: true };
    }
  }

  const merchantId = await resolveMerchantId(requesterEmail, input.merchantId);
  const ticketReference = extractTicketReference(subject);

  if (ticketReference) {
    const { data: existingTicket } = await admin
      .from('support_tickets')
      .select('id')
      .eq('public_id', ticketReference)
      .maybeSingle();

    if (existingTicket) {
      const { error: messageError } = await admin.from('ticket_messages').insert({
        ticket_id: existingTicket.id,
        sender_type: merchantId ? 'merchant' : 'visitor',
        sender_email: requesterEmail,
        external_message_id: externalMessageId,
        message,
        metadata: input.metadata || {},
      });
      if (messageError) throw new Error(messageError.message);

      await admin
        .from('support_tickets')
        .update({
          status: 'pending_admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingTicket.id);
      return { ticketId: existingTicket.id, duplicate: false };
    }
  }

  const { data: ticket, error: ticketError } = await admin
    .from('support_tickets')
    .insert({
      merchant_id: merchantId,
      requester_name: requesterName,
      requester_email: requesterEmail,
      recipient_email: input.recipientEmail
        ? normalizeEmailAddress(input.recipientEmail)
        : null,
      subject,
      category: input.category || 'other',
      status: 'pending_admin',
      priority: input.priority || 'normal',
      source: input.source,
    })
    .select('id, public_id')
    .single();
  if (ticketError || !ticket) {
    throw new Error(ticketError?.message || 'Création du ticket impossible');
  }

  const { error: messageError } = await admin.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: merchantId ? 'merchant' : 'visitor',
    sender_email: requesterEmail,
    external_message_id: externalMessageId,
    message,
    metadata: input.metadata || {},
  });
  if (messageError) {
    await admin.from('support_tickets').delete().eq('id', ticket.id);
    throw new Error(messageError.message);
  }

  return {
    ticketId: ticket.id,
    publicId: ticket.public_id,
    duplicate: false,
  };
}
