import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import Link from "next/link";
import { PaymentsFilter } from "./payments-filter";
import ExportCsvButton from "./ExportCsvButton";

export default async function PaymentsPage({
  searchParams
}: {
  searchParams: { q?: string, status?: string }
}) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  const queryParams = await searchParams;
  const searchQ = queryParams?.q || '';
  const filterStatus = queryParams?.status || 'all';

  let query = supabase
    .from('payments')
    .select('*, customers(name, email)')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test');

  if (filterStatus !== 'all') {
    query = query.eq('status', filterStatus);
  }

  const { data: payments } = await query.order('created_at', { ascending: false });

  const filteredPayments = payments ? payments.filter(p => {
    if (!searchQ) return true;
    const lowerQ = searchQ.toLowerCase();
    const customerName = p.customers?.name?.toLowerCase() || '';
    const customerEmail = p.customers?.email?.toLowerCase() || '';
    const ref = (p.kobara_reference || '').toLowerCase();
    const amt = p.amount?.toString() || '';
    return customerName.includes(lowerQ) || customerEmail.includes(lowerQ) || ref.includes(lowerQ) || amt.includes(lowerQ);
  }) : [];

  // Stats
  const { data: allPaymentsForStats } = await supabase
    .from('payments')
    .select('amount, net_amount, fee_amount, status, created_at')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalToday = 0;
  let totalWeek = 0;
  let refundCount = 0;

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  if (allPaymentsForStats) {
    allPaymentsForStats.forEach(p => {
      const pDate = new Date(p.created_at);
      if (p.status === 'succeeded' || p.status === 'completed') {
        if (pDate >= today) {
          totalToday += Number(p.net_amount || p.amount);
        }
        if (pDate >= oneWeekAgo) {
          totalWeek += Number(p.net_amount || p.amount);
        }
      }
      if (p.status === 'refunded') {
        refundCount++;
      }
    });
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6 md:space-y-8 pb-16">

      {/* TOP BAR: Search + Filters */}
      <PaymentsFilter exportButton={<ExportCsvButton payments={filteredPayments} />} />

      {/* STATS CARDS */}
      <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
        {/* Total Encaissé */}
        <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-3xl"></div>
          <div className="p-5 sm:p-6 pl-4 sm:pl-5">
            <div className="flex justify-between items-start mb-3">
              <p className="text-slate-400 text-xs sm:text-sm font-bold">Total Encaissé ce jour</p>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                <span className="material-symbols-outlined text-[20px] sm:text-[22px]">monetization_on</span>
              </div>
            </div>
            <h3 className="font-bold text-xl sm:text-2xl text-white tracking-tight">{totalToday.toLocaleString('fr-FR')} <span className="text-sm sm:text-base font-semibold text-slate-500">HTG</span></h3>
            <div className="mt-2 flex items-center gap-1.5 text-green-400 text-xs sm:text-sm">
              <span className="material-symbols-outlined text-[14px] sm:text-[16px]">trending_up</span>
              <span className="font-bold">+0.0%</span>
              <span className="text-slate-400">vs hier</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-green-400">
            <span className="material-symbols-outlined text-[80px] sm:text-[96px]">monetization_on</span>
          </div>
        </div>

        {/* Volume Hebdo + Remboursements */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:contents">
          {/* Volume Hebdo */}
          <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-3xl"></div>
            <div className="p-4 pl-3 sm:p-5 sm:pl-4 md:p-6 md:pl-5">
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <p className="text-slate-400 text-[11px] sm:text-xs md:text-sm font-bold">Volume Hebdo</p>
                <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] md:text-[22px]">bar_chart</span>
                </div>
              </div>
              <h3 className="font-bold text-base sm:text-lg md:text-xl text-white tracking-tight">{totalWeek.toLocaleString('fr-FR')} <span className="text-[11px] sm:text-xs md:text-sm text-slate-500 font-bold">HTG</span></h3>
              <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-slate-400 text-[10px] sm:text-xs">
                <span className="material-symbols-outlined text-[12px] sm:text-[14px]">trending_flat</span>
                <span>Stable</span>
              </div>
            </div>
            <div className="absolute -right-3 -bottom-3 opacity-[0.03] text-blue-400">
              <span className="material-symbols-outlined text-[60px] sm:text-[72px] md:text-[96px]">bar_chart</span>
            </div>
          </div>

          {/* Remboursements */}
          <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-3xl"></div>
            <div className="p-4 pl-3 sm:p-5 sm:pl-4 md:p-6 md:pl-5">
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <p className="text-slate-400 text-[11px] sm:text-xs md:text-sm font-bold">Remboursements</p>
                <div className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
                  <span className="material-symbols-outlined text-[16px] sm:text-[18px] md:text-[22px]">currency_exchange</span>
                </div>
              </div>
              <h3 className="font-bold text-base sm:text-lg md:text-xl text-white tracking-tight">0 <span className="text-[11px] sm:text-xs md:text-sm text-slate-500 font-bold">HTG</span></h3>
              <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-slate-400 text-[10px] sm:text-xs">
                <span className="material-symbols-outlined text-[12px] sm:text-[14px]">receipt_long</span>
                <span>{refundCount} transaction(s)</span>
              </div>
            </div>
            <div className="absolute -right-3 -bottom-3 opacity-[0.03] text-red-400">
              <span className="material-symbols-outlined text-[60px] sm:text-[72px] md:text-[96px]">currency_exchange</span>
            </div>
          </div>
        </div>
      </div>

      {/* TRANSACTIONS TABLE */}
      <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden">
        {/* Table Header Bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-400 text-[18px] sm:text-[20px]">receipt_long</span>
            <h2 className="font-bold text-white text-sm sm:text-base">Historique des transactions</h2>
          </div>
          <span className="text-slate-400 text-[11px] sm:text-xs font-bold bg-white/5 border border-white/10 px-2 py-0.5 rounded-md shadow-sm">{filteredPayments.length} résultat(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse md:min-w-[800px]">
            <thead>
              <tr className="border-b border-white/10 bg-transparent">
                <th className="py-3 px-4 sm:px-5 text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold">Client</th>
                <th className="py-3 px-4 sm:px-5 text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold">Montant</th>
                <th className="py-3 px-4 sm:px-5 text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold">Statut</th>
                <th className="hidden sm:table-cell py-3 px-5 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Méthode</th>
                <th className="hidden md:table-cell py-3 px-5 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Date</th>
                <th className="py-3 px-4 sm:px-5 text-right text-[10px] sm:text-[11px] text-slate-400 uppercase tracking-wider font-bold"></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments && filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className={`group cursor-pointer hover:bg-white/5 transition-all duration-150 border-b border-white/10 last:border-b-0`}>
                    {/* Client */}
                    <td className="py-3 sm:py-3.5 px-4 sm:px-5">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className={`h-7 w-7 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-bold text-white shrink-0 ${
                          payment.status === 'succeeded' ? 'bg-green-500' :
                          payment.status === 'failed' ? 'bg-red-500' :
                          'bg-orange-500'
                        }`}>
                          {(payment.customers?.name || 'CI').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[160px] md:max-w-none">{payment.customers?.name || 'Client Inconnu'}</div>
                          <div className="text-slate-400 text-[10px] sm:text-[11px] font-mono truncate max-w-[100px] sm:max-w-[140px] md:max-w-none">{payment.kobara_reference || `KOB-${payment.id.substring(0, 8).toUpperCase()}`}</div>
                        </div>
                      </div>
                    </td>
                    {/* Montant */}
                    <td className="py-3 sm:py-3.5 px-4 sm:px-5">
                      <div className={`font-bold text-xs sm:text-sm ${payment.status === 'succeeded' ? 'text-green-400' : 'text-white'}`}>+{Number(payment.net_amount || payment.amount).toLocaleString('fr-FR')} <span className="text-[10px] sm:text-xs text-slate-500">{payment.currency}</span></div>
                      <div className="text-slate-500 text-[10px] sm:text-[11px] mt-0.5">Brut: {Number(payment.amount || 0).toLocaleString('fr-FR')}</div>
                    </td>
                    {/* Statut */}
                    <td className="py-3 sm:py-3.5 px-4 sm:px-5">
                      <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-bold border ${
                        payment.status === 'succeeded' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                        payment.status === 'failed' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                        'bg-orange-500/20 text-orange-400 border-orange-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          payment.status === 'succeeded' ? 'bg-green-500' :
                          payment.status === 'failed' ? 'bg-red-500' :
                          'bg-orange-500'
                        }`}></span>
                        {payment.status === 'succeeded' ? 'Succès' : payment.status === 'failed' ? 'Échoué' : 'En attente'}
                      </span>
                    </td>
                    {/* Méthode */}
                    <td className="hidden sm:table-cell py-3.5 px-5">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span className="material-symbols-outlined text-[16px]">smartphone</span>
                        <span className="capitalize text-xs sm:text-sm text-white font-bold">
                          {payment.payment_method?.toLowerCase() === 'natcash' || payment.provider?.toLowerCase() === 'natcash' ? 'NatCash' : 'MonCash'}
                        </span>
                      </div>
                    </td>
                    {/* Date */}
                    <td className="hidden md:table-cell py-3.5 px-5 text-slate-400">
                      <div className="font-bold text-white text-xs sm:text-sm">{new Date(payment.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      <div className="text-[10px] sm:text-xs mt-0.5 text-slate-500">{new Date(payment.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    {/* Action */}
                    <td className="py-3 sm:py-3.5 px-4 sm:px-5 text-right">
                      <Link href={`/payments/${payment.id}`} className="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg hover:bg-orange-500/20 text-slate-500 hover:text-orange-400 transition-all duration-200">
                        <span className="material-symbols-outlined text-[16px] sm:text-[18px]">arrow_forward</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-16 sm:py-20">
                    <div className="flex flex-col items-center justify-center text-center px-4">
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-gradient-to-br from-orange-500/10 to-blue-500/10 flex items-center justify-center mb-5 sm:mb-6">
                        <span className="material-symbols-outlined text-[32px] sm:text-[40px] text-orange-400/60">receipt_long</span>
                      </div>
                      <h3 className="font-bold text-white text-base sm:text-lg mb-2">Aucun paiement pour le moment</h3>
                      <p className="text-slate-400 text-xs sm:text-sm max-w-xs sm:max-w-sm mb-5 sm:mb-6">Créez votre premier lien de paiement et commencez à recevoir des paiements MonCash et NatCash en quelques secondes.</p>
                      <Link href="/payment-links" className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 shadow-sm">
                        <span className="material-symbols-outlined text-[18px]">add_link</span>
                        Créer un lien de paiement
                      </Link>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
