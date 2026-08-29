import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/utils/supabase/admin";
import DashboardLayoutClient from "@/components/dashboard/dashboard-layout-client";

export default async function CustomerDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { merchant, user } = await getCurrentUserAndMerchant();

  if (!merchant) {
    redirect('/login');
  }

  const supabase = createAdminClient();

  // Fetch customer and their payments
  const { data: customer, error } = await supabase
    .from('customers')
    .select(`
      *,
      payments (
        id,
        transaction_reference,
        amount,
        net_amount,
        fee_amount,
        currency,
        status,
        provider,
        payment_method,
        created_at,
        environment
      )
    `)
    .eq('id', params.id)
    .eq('merchant_id', merchant.id)
    .single();

  if (error) {
    console.error("CUSTOMER FETCH ERROR:", error);
  }

  if (!customer) {
    return notFound();
  }

  const payments = customer.payments || [];
  const successfulPayments = payments.filter((p: any) => p.status === 'succeeded' || p.status === 'completed');
  const totalVolume = successfulPayments.reduce((sum: number, p: any) => sum + Number(p.net_amount || p.amount), 0);
  const totalFees = successfulPayments.reduce((sum: number, p: any) => sum + Number(p.fee_amount || 0), 0);

  // Sort payments by date descending
  payments.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/customers" className="p-2 -ml-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-3xl font-display-sm font-bold text-white tracking-tight">Détails du Client</h1>
            <p className="text-slate-400 mt-1">Consultez l'historique et les informations de {customer.name || 'ce client'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-white">
              <span className="material-symbols-outlined text-8xl">account_circle</span>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-white font-bold text-2xl shadow-sm`}>
                {(customer.name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">{customer.name || 'Client Inconnu'}</h2>
                <p className="text-sm text-slate-400">Client depuis {new Date(customer.created_at).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Email</p>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">mail</span>
                  {customer.email || 'Non renseigné'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Téléphone</p>
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-slate-500">phone</span>
                  {customer.phone || 'Non renseigné'}
                </p>
              </div>
              {customer.wallet && (
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Portefeuille par défaut</p>
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-slate-500">account_balance_wallet</span>
                    {customer.wallet}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-white mb-4">Statistiques</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-sm text-slate-400">Volume Total Net</span>
                <span className="font-bold text-white">{totalVolume.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-sm text-slate-400">Total Frais</span>
                <span className="font-bold text-slate-400">{totalFees.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} HTG</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Paiements Réussis</span>
                <span className="font-bold text-green-400 bg-green-500/20 border border-green-500/20 px-2 py-0.5 rounded-full text-xs">
                  {successfulPayments.length} / {payments.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transactions */}
        <div className="lg:col-span-2">
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Historique des transactions</h2>
              <span className="text-sm text-slate-400 font-bold">{payments.length} transactions</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-transparent border-b border-white/10 text-xs uppercase tracking-wider text-slate-400 font-bold">
                    <th className="py-3 px-6">Référence</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Méthode</th>
                    <th className="py-3 px-6 text-right">Montant Brut</th>
                    <th className="py-3 px-6">Statut</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/10">
                  {payments.length > 0 ? payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-3 px-6 font-mono text-xs text-white font-bold">{payment.transaction_reference || payment.id.split('-')[0]}</td>
                      <td className="py-3 px-6">
                        <div className="font-bold text-white">{new Date(payment.created_at).toLocaleDateString('fr-FR')}</div>
                        <div className="text-xs text-slate-400">{new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' })}</div>
                      </td>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-orange-500/20 flex items-center justify-center text-orange-400">
                            <span className="material-symbols-outlined text-[14px]">smartphone</span>
                          </div>
                          <span className="capitalize font-bold text-white">{payment.provider}</span>
                        </div>
                      </td>
                      <td className="py-3 px-6 text-right font-bold text-white">
                        {Number(payment.amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {payment.currency}
                      </td>
                      <td className="py-3 px-6">
                        {payment.status === 'succeeded' || payment.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            Succès
                          </span>
                        ) : payment.status === 'failed' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Échoué
                          </span>
                        ) : payment.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                            En attente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-white/10 text-slate-400 border border-white/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                            {payment.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                        Aucune transaction pour ce client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
