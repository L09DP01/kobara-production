import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import Link from "next/link";
import LinkActions from "./LinkActions";

export default async function PaymentLinksPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  // Fetch payment links
  const { data: paymentLinks } = await supabase
    .from('payment_links')
    .select('*')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test')
    .order('created_at', { ascending: false });

  // Fetch payments to calculate stats per link
  const { data: payments } = await supabase
    .from('payments')
    .select('payment_link_id, amount, status')
    .eq('merchant_id', merchant.id)
    .eq('environment', merchant.current_environment || 'test')
    .eq('status', 'succeeded')
    .not('payment_link_id', 'is', null);

  // Calculate totals
  let totalLinkRevenue = 0;
  const linkStats: Record<string, { count: number, total: number }> = {};
  
  if (payments) {
    payments.forEach(p => {
      if (p.payment_link_id) {
        if (!linkStats[p.payment_link_id]) {
          linkStats[p.payment_link_id] = { count: 0, total: 0 };
        }
        linkStats[p.payment_link_id].count++;
        linkStats[p.payment_link_id].total += Number(p.amount);
        totalLinkRevenue += Number(p.amount);
      }
    });
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Liens de Paiement</h1>
          <p className="text-slate-400 text-sm mt-1">Créez et gérez vos liens de paiement partageables.</p>
        </div>
        <Link 
          href="/payment-links/create"
          className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Créer un lien de paiement
        </Link>
      </div>

      <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="py-4 px-6 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Lien</th>
                <th className="py-4 px-6 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Montant</th>
                <th className="py-4 px-6 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Ventes</th>
                <th className="py-4 px-6 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Statut</th>
                <th className="py-4 px-6 text-[11px] text-slate-400 uppercase tracking-wider font-bold">Créé le</th>
                <th className="py-4 px-6 text-right text-[11px] text-slate-400 uppercase tracking-wider font-bold">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm text-white divide-y divide-white/10">
              {paymentLinks && paymentLinks.length > 0 ? (
                paymentLinks.map(link => {
                  const stats = linkStats[link.id] || { count: 0, total: 0 };
                  const isExpired = link.expires_at && new Date(link.expires_at) < new Date();
                  let statusLabel = link.status === 'active' && !isExpired ? 'Actif' : isExpired ? 'Expiré' : 'Inactif';
                  let statusStyles = link.status === 'active' && !isExpired 
                    ? 'bg-green-500/20 text-green-400 border-green-500/20 bg-green-500'
                    : 'bg-orange-500/20 text-orange-400 border-orange-500/20 bg-orange-500';

                  return (
                    <tr key={link.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="font-bold text-white">{link.title}</div>
                        <div className="text-slate-400 text-xs flex items-center gap-1 mt-1 cursor-pointer hover:text-white transition-colors">
                          <span className="material-symbols-outlined text-[14px]">link</span>
                          {`pay.kobara.app/${link.slug || link.id}`}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold">{Number(link.amount).toLocaleString('fr-FR')} {link.currency}</div>
                        <div className="text-slate-400 text-xs">Paiement {link.amount ? 'unique' : 'ouvert'}</div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="font-bold">{stats.count}</div>
                        <div className="text-green-400 text-xs">{stats.total.toLocaleString('fr-FR')} {link.currency}</div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold border ${statusStyles.split(' ').slice(0, 3).join(' ')}`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusStyles.split(' ')[3]}`}></span>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-400">
                        <div>{new Date(link.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <LinkActions 
                          linkId={link.id} 
                          linkUrl={`https://pay.kobara.app/${link.slug || link.id}`} 
                        />
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun lien de paiement.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {paymentLinks && paymentLinks.length > 0 && (
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
            <p className="text-xs text-slate-400">Affichage de <span className="font-bold text-white">1</span> à <span className="font-bold text-white">{paymentLinks.length}</span> sur <span className="font-bold text-white">{paymentLinks.length}</span> liens</p>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 border border-white/10 bg-white/5 rounded-lg text-xs font-bold text-slate-500 disabled:opacity-50" disabled>Précédent</button>
              <button className="px-3 py-1.5 border border-white/10 bg-white/5 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-colors disabled:opacity-50" disabled>Suivant</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
