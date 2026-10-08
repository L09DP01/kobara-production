'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendAdminWhatsAppMessage, setConversationAiState } from '@/lib/server/whatsapp/service';

export async function replyToWhatsApp(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);
  const conversationId = String(formData.get('conversationId') || '');
  const message = String(formData.get('message') || '').trim();
  if (!conversationId || !message || message.length > 3900) throw new Error('Réponse WhatsApp invalide');
  await sendAdminWhatsAppMessage(conversationId, message);
  const admin = createAdminClient();
  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    action: 'whatsapp.replied',
    entity_type: 'whatsapp_conversations',
    entity_id: conversationId,
    metadata: { ai_paused_hours: 12 },
  });
  revalidatePath('/system-core/whatsapp');
}

export async function toggleWhatsAppAi(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);
  const conversationId = String(formData.get('conversationId') || '');
  const enabled = String(formData.get('enabled')) === 'true';
  if (!conversationId) throw new Error('Conversation requise');
  await setConversationAiState(conversationId, enabled);
  const admin = createAdminClient();
  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    action: enabled ? 'whatsapp.ai_enabled' : 'whatsapp.ai_paused',
    entity_type: 'whatsapp_conversations',
    entity_id: conversationId,
    metadata: enabled ? {} : { duration_hours: 12 },
  });
  revalidatePath('/system-core/whatsapp');
}

export async function closeWhatsAppConversation(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations', 'support']);
  const conversationId = String(formData.get('conversationId') || '');
  if (!conversationId) throw new Error('Conversation requise');
  const admin = createAdminClient();
  const { data: messages } = await admin.from('whatsapp_messages').select('sender_type,body').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(12);
  const summary = (messages || []).reverse().map((message) => `${message.sender_type}: ${message.body || ''}`).join('\n').slice(0, 5000);
  const { data: conversation } = await admin.from('whatsapp_conversations').select('contact_id').eq('id', conversationId).single();
  const now = new Date().toISOString();
  await admin.from('whatsapp_conversations').update({ status: 'closed', closed_at: now, summary, updated_at: now }).eq('id', conversationId);
  if (conversation?.contact_id) await admin.from('whatsapp_contacts').update({ memory_summary: summary, updated_at: now }).eq('id', conversation.contact_id);
  await admin.from('audit_logs').insert({ admin_id: session.user.id, action: 'whatsapp.closed', entity_type: 'whatsapp_conversations', entity_id: conversationId });
  revalidatePath('/system-core/whatsapp');
}
