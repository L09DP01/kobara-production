import Link from 'next/link';
import { Bot, CheckCheck, CircleUserRound, Clock3, ExternalLink, Inbox, MessageCircleMore, PauseCircle, Send, Settings2, TicketCheck } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getWhatsAppConfigurationStatus } from '@/lib/server/whatsapp/client';
import { closeWhatsAppConversation, replyToWhatsApp, toggleWhatsAppAi } from './actions';

export const dynamic = 'force-dynamic';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default async function WhatsAppAdminPage({ searchParams }: { searchParams: Promise<{ conversation?: string; view?: string }> }) {
  await requireAdmin(['super_admin', 'operations', 'support']);
  const query = await searchParams;
  const view = ['inbox', 'tickets', 'configuration'].includes(query.view || '') ? query.view! : 'inbox';
  const admin = createAdminClient();
  const { data: conversations } = await admin
    .from('whatsapp_conversations')
    .select('*, whatsapp_contacts(id,display_name,phone_e164,email,email_verified_at,merchant_id), support_tickets(public_id,status)')
    .order('last_message_at', { ascending: false })
    .limit(100);
  const filtered = view === 'tickets' ? (conversations || []).filter((item: any) => item.ticket_id) : (conversations || []);
  const selectedId = query.conversation || filtered[0]?.id;
  const selected = (conversations || []).find((item: any) => item.id === selectedId);
  const { data: messages } = selectedId
    ? await admin.from('whatsapp_messages').select('*').eq('conversation_id', selectedId).order('created_at', { ascending: true }).limit(250)
    : { data: [] };
  const configuration = getWhatsAppConfigurationStatus();
  const aiActive = selected && selected.status === 'open' && (!selected.ai_paused_until || new Date(selected.ai_paused_until).getTime() <= Date.now());

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-400">Support multicanal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">WhatsApp</h1>
          <p className="mt-1 text-sm text-slate-400">Conversations Kobara, tickets et relais humain.</p>
        </div>
        <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> {filtered.length} conversations
        </div>
      </header>

      <nav className="inline-flex max-w-full overflow-x-auto rounded border border-slate-800 bg-slate-900 p-1" aria-label="Sections WhatsApp">
        {[
          ['inbox', 'Inbox', Inbox],
          ['tickets', 'Tickets', TicketCheck],
          ['configuration', 'Configuration', Settings2],
        ].map(([key, label, Icon]) => (
          <Link key={String(key)} href={`/system-core/whatsapp?view=${key}`} className={`inline-flex min-h-10 items-center gap-2 rounded px-4 text-sm font-bold ${view === key ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Icon className="h-4 w-4" /> {String(label)}
          </Link>
        ))}
      </nav>

      {view === 'configuration' ? (
        <section className="border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-bold text-white">État de la connexion</h2>
          <p className="mt-1 text-sm text-slate-400">Les secrets restent uniquement dans les variables d’environnement du serveur.</p>
          <div className="mt-6 grid gap-px overflow-hidden border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(configuration).map(([key, ready]) => (
              <div key={key} className="flex items-center justify-between bg-slate-950 p-4">
                <span className="text-xs uppercase tracking-wider text-slate-400">{key}</span>
                <span className={`text-xs font-bold ${ready ? 'text-emerald-400' : 'text-amber-400'}`}>{ready ? 'CONFIGURÉ' : 'MANQUANT'}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 border-l-2 border-red-500 bg-slate-950 p-4 text-sm text-slate-300">
            Webhook Meta: <code className="text-red-300">https://kobara.app/api/webhooks/whatsapp</code>. Configurez également <code>WHATSAPP_GRAPH_API_VERSION</code> avec la version activée dans votre application Meta; Kobara ne la devine pas.
          </div>
        </section>
      ) : (
        <section className="grid min-h-[640px] overflow-hidden border border-slate-800 bg-slate-900 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="border-b border-slate-800 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-800 p-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Conversations</div>
            <div className="max-h-[640px] overflow-y-auto">
              {filtered.map((conversation: any) => {
                const contact = conversation.whatsapp_contacts;
                return (
                  <Link key={conversation.id} href={`/system-core/whatsapp?view=${view}&conversation=${conversation.id}`} className={`block border-b border-slate-800 p-4 transition-colors ${conversation.id === selectedId ? 'bg-red-950/30' : 'hover:bg-slate-800/60'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{contact?.display_name || `Client •••• ${contact?.phone_e164?.slice(-4)}`}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{contact?.email || `+${contact?.phone_e164}`}</p>
                      </div>
                      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${conversation.status === 'human' ? 'bg-amber-400' : conversation.status === 'closed' ? 'bg-slate-600' : 'bg-emerald-400'}`} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>{conversation.ticket_id ? 'Ticket lié' : conversation.status}</span><span>{dateLabel(conversation.last_message_at)}</span></div>
                  </Link>
                );
              })}
              {!filtered.length && <div className="p-8 text-center text-sm text-slate-500">Aucune conversation.</div>}
            </div>
          </aside>

          <div className="flex min-w-0 flex-col">
            {selected ? (
              <>
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-800 text-slate-300"><CircleUserRound className="h-5 w-5" /></div>
                    <div className="min-w-0"><p className="truncate font-bold text-white">{selected.whatsapp_contacts?.display_name || 'Client WhatsApp'}</p><p className="truncate text-xs text-slate-500">+{selected.whatsapp_contacts?.phone_e164} {selected.whatsapp_contacts?.email_verified_at ? '· e-mail vérifié' : ''}</p></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${aiActive ? 'border-emerald-800 bg-emerald-950/40 text-emerald-300' : 'border-amber-800 bg-amber-950/40 text-amber-300'}`}>{aiActive ? <Bot className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}{aiActive ? 'Assistant actif' : 'Relais humain'}</span>
                    <form action={toggleWhatsAppAi}><input type="hidden" name="conversationId" value={selected.id} /><input type="hidden" name="enabled" value={aiActive ? 'false' : 'true'} /><button className="min-h-9 rounded border border-slate-700 px-3 text-xs font-bold text-slate-300 hover:bg-slate-800">{aiActive ? 'Suspendre 12 h' : 'Réactiver'}</button></form>
                  </div>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto bg-slate-950/40 p-4 sm:p-6">
                  {(messages || []).map((message: any) => {
                    const outbound = message.direction === 'outbound';
                    return (
                      <article key={message.id} className={`max-w-[86%] ${outbound ? 'ml-auto' : ''}`}>
                        <div className={`rounded-md px-4 py-3 text-sm leading-6 ${outbound ? 'bg-red-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-200'}`}>
                          {message.message_type === 'image' && <p className="mb-2 text-xs font-bold uppercase opacity-70">Capture reçue</p>}
                          <p className="whitespace-pre-wrap break-words">{message.body}</p>
                        </div>
                        <p className={`mt-1 flex items-center gap-1 text-[10px] text-slate-600 ${outbound ? 'justify-end' : ''}`}>{message.sender_type} · {dateLabel(message.created_at)} {outbound && <CheckCheck className="h-3 w-3" />}</p>
                      </article>
                    );
                  })}
                  {!messages?.length && <div className="grid h-full place-items-center text-sm text-slate-600"><MessageCircleMore className="mb-2 h-8 w-8" />Aucun message</div>}
                </div>

                <footer className="border-t border-slate-800 p-4">
                  <form action={replyToWhatsApp} className="flex gap-2">
                    <input type="hidden" name="conversationId" value={selected.id} />
                    <label className="sr-only" htmlFor="whatsapp-reply">Réponse WhatsApp</label>
                    <textarea id="whatsapp-reply" name="message" required rows={2} maxLength={3900} placeholder="Écrire une réponse sûre…" className="min-h-12 flex-1 resize-none rounded border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white placeholder:text-slate-600" />
                    <button type="submit" aria-label="Envoyer" className="grid w-12 place-items-center rounded bg-red-600 text-white hover:bg-red-500"><Send className="h-5 w-5" /></button>
                  </form>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>Une réponse humaine suspend l’assistant pendant 12 heures.</span>
                    <div className="flex items-center gap-3">{selected.ticket_id && <Link href={`/system-core/support/${selected.ticket_id}`} className="inline-flex items-center gap-1 text-red-400">Ouvrir le ticket <ExternalLink className="h-3 w-3" /></Link>}<form action={closeWhatsAppConversation}><input type="hidden" name="conversationId" value={selected.id} /><button className="inline-flex items-center gap-1 hover:text-white"><Clock3 className="h-3 w-3" />Fermer et mémoriser</button></form></div>
                  </div>
                </footer>
              </>
            ) : <div className="grid min-h-[520px] place-items-center text-slate-600">Sélectionnez une conversation.</div>}
          </div>
        </section>
      )}
    </div>
  );
}
