import { WandSparkles, Send, Pause, Check, Mail } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { PROMOTION_SEGMENTS, isPromotionSegment } from '@/lib/smart-promotions';
import { isPublicKnowledgeUrl } from '@/lib/support-knowledge-page';
import { generateDraft, setPromotionStatus, sendApprovedPromotions } from './actions';

export const dynamic = 'force-dynamic';
export default async function SmartPromotionsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await requireAdmin(['super_admin', 'operations']);
  const db = createAdminClient();
  const [audiences, campaigns, params] = await Promise.all([
    db.rpc('smart_promotion_audiences'),
    db.from('smart_promotions').select('id,segment,subject,body,sources,status,created_at,smart_promotion_recipients(id,email,status)').order('created_at', { ascending: false }).limit(20),
    searchParams,
  ]);
  const ready = !audiences.error && !campaigns.error;
  return <div className="mx-auto max-w-6xl space-y-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6">
      <div><h1 className="text-2xl font-bold">Promotions intelligentes</h1><p className="mt-2 text-sm text-slate-400">Audiences marchandes et campagnes approuvées.</p></div>
      <form action={sendApprovedPromotions}><button disabled={!ready} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-40"><Send className="h-4 w-4"/>Envoyer le prochain lot</button></form>
    </header>
    {!ready && <p role="status" className="rounded-md border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">Configuration requise : appliquez les migrations des rappels d’activation et des promotions intelligentes.</p>}
    {params.notice && <p role="status" className="border-l-2 border-orange-500 pl-4 text-sm text-slate-200">{params.notice}</p>}
    <section aria-label="Audiences" className="grid gap-4 md:grid-cols-3">
      {Object.entries(PROMOTION_SEGMENTS).map(([key, segment]) => {
        const counts = audiences.data?.find((r: { segment: string }) => r.segment === key);
        return <div key={key} className="rounded-md border border-slate-800 bg-slate-900 p-5"><h2 className="text-sm font-bold">{segment.label}</h2><p className="mt-4 text-3xl font-bold">{ready ? counts?.eligible || 0 : '—'}</p><p className="mt-2 text-xs text-slate-400">Éligibles avec consentement / {ready ? counts?.matching || 0 : '—'} correspondants</p></div>;
      })}
    </section>
    <form action={generateDraft} className="grid items-end gap-4 border-y border-slate-800 py-6 md:grid-cols-[1fr_130px_auto]">
      <label className="text-sm font-semibold">Audience<select name="segment" className="mt-2 min-h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3">{Object.entries(PROMOTION_SEGMENTS).map(([key, segment]) => <option key={key} value={key}>{segment.label}</option>)}</select></label>
      <label className="text-sm font-semibold">Échantillon<input type="number" name="limit" min="1" max="50" defaultValue="10" required className="mt-2 min-h-11 w-full rounded-md border border-slate-700 bg-slate-900 px-3"/></label>
      <button disabled={!ready} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-orange-600 px-4 text-sm font-bold text-orange-300 disabled:opacity-40"><WandSparkles className="h-4 w-4"/>Générer un brouillon</button>
    </form>
    <p className="text-sm leading-6 text-slate-400">Sélection aléatoire parmi les comptes consentants. Au plus une promotion par destinataire sur quatorze jours. Les comptes en difficulté et ceux rappelés aujourd’hui sont exclus. Aucun envoi sans approbation.</p>
    <section className="space-y-5" aria-label="Campagnes">
      {(campaigns.data || []).map(c => <article key={c.id} className="rounded-md border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-orange-300">{isPromotionSegment(c.segment) ? PROMOTION_SEGMENTS[c.segment].label : c.segment} · {c.status}</p><h2 className="mt-2 text-lg font-bold">{c.subject}</h2></div>
          {c.status !== 'completed' && <form action={setPromotionStatus}><input type="hidden" name="id" value={c.id}/><input type="hidden" name="status" value={c.status === 'approved' ? 'paused' : 'approved'}/><button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-600 px-3 text-sm">{c.status === 'approved' ? <Pause className="h-4 w-4"/> : <Check className="h-4 w-4"/>}{c.status === 'approved' ? 'Suspendre' : 'Approuver l’envoi'}</button></form>}
        </div>
        <p className="mt-5 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-200">{c.body}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-orange-300">{(Array.isArray(c.sources) ? c.sources : []).filter((s: unknown): s is { title: string; url: string } => Boolean(s && typeof s === 'object' && 'title' in s && typeof s.title === 'string' && 'url' in s && typeof s.url === 'string' && isPublicKnowledgeUrl(s.url))).map((source: { title: string; url: string }) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{source.title}</a>)}</div>
        <details className="mt-5 border-t border-slate-800 pt-4"><summary className="cursor-pointer text-sm text-slate-300">Destinataires et suivi ({c.smart_promotion_recipients?.length || 0})</summary><ul className="mt-3 space-y-2">{c.smart_promotion_recipients?.map((r: { id: string; email: string; status: string }) => <li key={r.id} className="flex flex-wrap justify-between gap-2 text-xs"><span className="break-all">{r.email}</span><span>{r.status}</span></li>)}</ul></details>
      </article>)}
      {ready && !campaigns.data?.length && <p className="flex items-center gap-3 py-8 text-sm text-slate-400"><Mail className="h-5 w-5"/>Aucun brouillon pour le moment.</p>}
    </section>
  </div>;
}
