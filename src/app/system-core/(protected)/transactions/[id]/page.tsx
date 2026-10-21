import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil, Save, X } from 'lucide-react';
import { createAdminClient } from '@/utils/supabase/admin';
import { updatePendingPayment } from '../actions';

const errorMessages: Record<string, string> = {
  status: 'Choisissez un statut et confirmez la verification du paiement.',
  reference: 'Le code de référence doit contenir entre 4 et 64 lettres ou chiffres.',
  method: 'Cette méthode de paiement ne peut pas être sélectionnée.',
  not_found: 'Ce paiement Live est introuvable.',
  not_pending: "Ce paiement n'est plus en attente et ne peut plus être modifié.",
  update_failed: "La correction n'a pas pu être enregistrée.",
};

export default async function AdminTransactionDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; saved?: string; error?: string; warning?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('*, merchants(id, business_name, email)')
    .eq('id', id)
    .eq('environment', 'live')
    .maybeSingle();
  if (!payment) notFound();

  const [{ data: webhookEvents }, { data: audits }] = await Promise.all([
    supabase.from('webhook_events').select('*').eq('merchant_id', payment.merchant_id).eq('environment', payment.environment || 'live').order('created_at', { ascending: false }).limit(100),
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
      <div className="flex flex-wrap items-start gap-3 sm:gap-4">
        <Link href="/system-core/transactions" className="p-2 border border-slate-700 rounded text-slate-400 hover:text-white"><ArrowLeft className="w-4 h-4" /></Link>
        <div><h1 className="text-xl font-bold">TRANSACTION</h1><p className="text-xs text-slate-500 font-mono mt-1 break-all">{payment.id}</p></div>
        <div className="ml-auto flex items-center gap-2">
          <span className="px-2 py-1 text-xs font-bold rounded border border-slate-700">{payment.status?.toUpperCase()}</span>
          {payment.status === 'pending' && query.edit !== '1' ? (
            <Link href={`/system-core/transactions/${id}?edit=1`} aria-label="Corriger ce paiement" title="Corriger ce paiement en attente" className="inline-flex h-9 w-9 items-center justify-center rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
              <Pencil className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </div>

      {query.saved === '1' ? <p className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">Statut enregistré.</p> : null}
      {query.warning ? <p className="border border-amber-500/30 p-3 text-sm text-amber-300">Le statut est enregistré, mais un traitement associé nécessite une vérification technique. Ne confirmez pas une seconde fois le paiement.</p> : null}
      {query.error ? <p className="border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{errorMessages[query.error] || 'Une erreur est survenue.'}</p> : null}

      {payment.status === 'pending' && query.edit === '1' ? (
        <section className="border border-amber-500/30 bg-slate-900 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-amber-300">CORRIGER LE PAIEMENT EN ATTENTE</h2>
              <p className="mt-1 text-xs text-slate-500">Seul le statut peut être modifié. Les autres informations sont conservées.</p>
            </div>
            <Link href={`/system-core/transactions/${id}`} aria-label="Annuler la correction" className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-700 text-slate-400 hover:text-white"><X className="h-4 w-4" /></Link>
          </div>
          <form action={updatePendingPayment} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="hidden" name="payment_id" value={id} />
            <label className="space-y-1.5 text-xs text-slate-400">Code de référence
              <input readOnly value={payment.reference_code || ''} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-400" />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">Référence externe
              <input readOnly value={payment.external_reference || ''} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-400" />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">Méthode
              <select disabled defaultValue={payment.payment_method || payment.provider || 'moncash'} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-400">
                <option value="moncash">MonCash</option>
                <option value="moncash_ussd">MonCash USSD</option>
                <option value="natcash">NatCash</option>
                <option value="paypal">PayPal</option>
                <option value="card">Carte</option>
                <option value="carte">Carte (API)</option>
                <option value="apple_pay">Apple Pay</option>
                <option value="google_pay">Google Pay</option>
                <option value="balance">Solde Kobara</option>
                <option value="kobara">Transfert Kobara</option>
              </select>
            </label>
            <label className="space-y-1.5 text-xs text-slate-400">Nom du client
              <input readOnly value={payment.metadata?.customer_name || ''} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-400" />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400 md:col-span-2">Téléphone du client
              <input readOnly value={payment.metadata?.customer_phone || ''} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-400" />
            </label>
            <label className="space-y-1.5 text-xs text-slate-400 md:col-span-2">Statut du paiement
              <select name="status" required defaultValue="" className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">
                <option value="" disabled>En attente : choisir le nouveau statut</option>
                <option value="succeeded">Réussi</option>
                <option value="failed">Échoué</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-xs text-amber-200 md:col-span-2">
              <input type="checkbox" name="confirmed" value="yes" required className="mt-0.5" />
              J’ai vérifié le résultat auprès du fournisseur. Le statut Réussi crédite le marchand et déclenche les confirmations de paiement.
            </label>
            <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-400 md:col-span-2 md:w-auto md:justify-self-end">
              <Save className="h-4 w-4" /> ENREGISTRER LA CORRECTION
            </button>
          </form>
        </section>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="min-w-0 bg-slate-900 border border-slate-800 rounded p-4 sm:p-5">
          <h2 className="text-sm font-bold text-slate-400 mb-4">PAIEMENT</h2>
          <dl className="space-y-3">{fields.map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-800 pb-2"><dt className="text-xs text-slate-500">{label}</dt><dd className="text-xs text-slate-200 text-right break-all">{value || '—'}</dd></div>)}</dl>
        </section>
        <section className="min-w-0 bg-slate-900 border border-slate-800 rounded p-4 sm:p-5">
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
