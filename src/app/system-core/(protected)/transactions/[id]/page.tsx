import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';

export default async function AdminTransactionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('*, merchants(id, business_name, email)')
    .eq('id', id)
    .eq('environment', 'live')
    .maybeSingle();
  if (!payment) notFound();

  const [{ data: webhookEvents }, { data: audits }] = await Promise.all([
    supabase.from('webhook_events').select('*').eq('merchant_id', payment.merchant_id).eq('environment', payment.environment || 'test').order('created_at', { ascending: false }).limit(100),
    supabase.from('audit_logs').select('*').eq('entity_id', id).order('created_at', { ascending: false }),
  ]);
  const relatedWebhooks = (webhookEvents || []).filter((event) => event.payload?.data?.id === id || event.payload?.payment_id === id);

  const fields = [
    ['Référence Kobara', payment.kobara_reference],
    ['Référence externe', payment.external_reference],
    ['Méthode', payment.payment_method],
    ['Fournisseur', payment.provider],
    ['Environnement', payment.environment],
    ['Montant brut', `${Number(payment.amount || 0).toLocaleString('fr-FR')} HTG`],
    ['Frais', `${Number(payment.fee_amount || 0).toLocaleString('fr-FR')} HTG`],
    ['Net', `${Number(payment.net_amount || 0).toLocaleString('fr-FR')} HTG`],
    ['Créé', new Date(payment.created_at).toLocaleString('fr-FR')],
    ['Payé', payment.paid_at ? new Date(payment.paid_at).toLocaleString('fr-FR') : '—'],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/system-core/transactions" className="p-2 border border-slate-700 rounded text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
        <div><h1 className="text-xl font-bold">TRANSACTION</h1><p className="text-xs text-slate-500 font-mono mt-1 break-all">{payment.id}</p></div>
        <span className="ml-auto px-2 py-1 text-xs font-bold rounded border border-slate-700">{payment.status?.toUpperCase()}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="bg-slate-900 border border-slate-800 rounded p-5">
          <h2 className="text-sm font-bold text-slate-400 mb-4">PAIEMENT</h2>
          <dl className="space-y-3">{fields.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-800 pb-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-xs text-slate-200 text-right break-all">{value || '—'}</dd></div>)}</dl>
        </section>
        <section className="bg-slate-900 border border-slate-800 rounded p-5">
          <h2 className="text-sm font-bold text-slate-400 mb-4">MARCHAND</h2>
          <p className="font-bold text-white">{payment.merchants?.business_name || 'Inconnu'}</p>
          <p className="text-xs text-slate-500 mt-1">{payment.merchants?.email}</p>
          <Link href={`/system-core/merchants/${payment.merchant_id}`} className="inline-block mt-4 text-xs text-red-400 hover:underline">Ouvrir le marchand</Link>
          <h3 className="text-xs font-bold text-slate-500 mt-6 mb-2">MÉTADONNÉES</h3>
          <pre className="text-[10px] bg-slate-950 border border-slate-800 rounded p-3 overflow-auto max-h-64">{JSON.stringify(payment.metadata || {}, null, 2)}</pre>
        </section>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded p-5">
        <h2 className="text-sm font-bold text-slate-400 mb-4">CHRONOLOGIE</h2>
        {[...(audits || []).map((a) => ({ id: a.id, at: a.created_at, title: a.action, detail: a.metadata })), ...relatedWebhooks.map((w) => ({ id: w.id, at: w.created_at, title: `Webhook ${w.delivery_status}`, detail: { event: w.event_type, retries: w.retry_count } }))]
          .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
          .map(item => <div key={item.id} className="border-l border-slate-700 pl-4 py-2"><div className="text-xs font-bold text-slate-200">{item.title}</div><div className="text-[10px] text-slate-500">{new Date(item.at).toLocaleString('fr-FR')}</div><pre className="text-[10px] text-slate-500 mt-1 whitespace-pre-wrap">{JSON.stringify(item.detail)}</pre></div>)}
        {(audits || []).length === 0 && relatedWebhooks.length === 0 && <p className="text-sm text-slate-500">Aucun événement associé.</p>}
      </section>
    </div>
  );
}
