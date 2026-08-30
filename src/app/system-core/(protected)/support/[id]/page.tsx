import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ArrowLeft, Send } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('*, merchants(id, business_name, email)')
    .eq('id', id)
    .maybeSingle();

  if (!ticket) notFound();

  const { data: messages } = await supabase
    .from('ticket_messages')
    .select('*')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  async function reply(formData: FormData) {
    'use server';
    const session = await requireAdmin(['super_admin', 'support', 'operations']);
    const message = String(formData.get('message') || '').trim();
    const status = String(formData.get('status') || 'pending_merchant');
    if (!message) throw new Error('Message requis');
    if (!['pending_admin', 'pending_merchant', 'closed'].includes(status)) throw new Error('Statut invalide');

    const admin = createAdminClient();
    const { error: messageError } = await admin.from('ticket_messages').insert({
      ticket_id: id,
      sender_type: 'admin',
      message,
    });
    if (messageError) throw new Error(messageError.message);

    const { error: updateError } = await admin.from('support_tickets').update({
      status,
      assigned_admin_id: session.user.id,
      resolved_at: status === 'closed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (updateError) throw new Error(updateError.message);

    await admin.from('audit_logs').insert({
      admin_id: session.user.id,
      merchant_id: ticket.merchant_id,
      action: 'support.replied',
      entity_type: 'support_tickets',
      entity_id: id,
      metadata: { status },
    });

    const recipient = ticket.requester_email || ticket.merchants?.email;
    if (recipient) {
      const { sendEmail } = await import('@/lib/server/mail');
      await sendEmail({
        to: recipient,
        subject: `[${ticket.public_id}] Réponse Kobara : ${ticket.subject}`,
        text: message,
        replyTo: 'support@kobara.app',
      });
    }
    revalidatePath(`/system-core/support/${id}`);
    revalidatePath('/system-core/support');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/system-core/support" className="p-2 rounded border border-slate-700 text-slate-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-white break-words">{ticket.subject}</h1>
          <p className="text-xs text-slate-500 mt-1">{ticket.public_id || id} · {ticket.merchants?.business_name || ticket.requester_name || 'Visiteur'} · {ticket.requester_email || ticket.merchants?.email || 'E-mail indisponible'} · {ticket.category || 'other'} · {ticket.status}</p>
        </div>
      </div>

      <div className="space-y-3">
        {(messages || []).map((message) => (
          <div key={message.id} className={`max-w-3xl p-4 rounded border ${message.sender_type === 'admin' ? 'ml-auto bg-red-950/20 border-red-900/40' : 'bg-slate-900 border-slate-800'}`}>
            <div className="text-[10px] uppercase font-bold text-slate-500 mb-2">{message.sender_type === 'admin' ? 'Administration Kobara' : ticket.merchants?.business_name || ticket.requester_name || message.sender_email || 'Visiteur'}</div>
            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{message.message}</p>
            <div className="text-[10px] text-slate-600 mt-2">{new Date(message.created_at).toLocaleString('fr-FR')}</div>
          </div>
        ))}
      </div>

      <form action={reply} className="bg-slate-900 border border-slate-800 p-5 rounded space-y-4">
        <textarea name="message" required rows={5} placeholder="Réponse au demandeur..." className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm text-white resize-y" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select name="status" defaultValue="pending_merchant" className="bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white">
            <option value="pending_merchant">En attente du marchand</option>
            <option value="pending_admin">Reste ouvert</option>
            <option value="closed">Fermer le ticket</option>
          </select>
          <button type="submit" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold">
            <Send className="w-4 h-4" /> Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
