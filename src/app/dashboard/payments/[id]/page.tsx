import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentMethodDisplay } from "@/lib/payment-method-display";

type Params = Promise<{ id: string }>;

export default async function PaymentDetailsPage(props: { params: Params }) {
  const params = await props.params;
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  const { data: payment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', params.id)
    .eq('merchant_id', merchant.id)
    .single();

  if (error) {
    console.error("Error fetching payment details:", error);
  }

  if (!payment) {
    console.log("Payment not found for ID:", params.id, "and merchant:", merchant.id);
    notFound();
  }

  let customer = null;
  if (payment.customer_id) {
    const { data: cData } = await supabase
      .from('customers')
      .select('*')
      .eq('id', payment.customer_id)
      .single();
    customer = cData;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'succeeded':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400"><span className="w-2 h-2 rounded-full mr-2 bg-green-500"></span>Succès</span>;
      case 'pending':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-500/20 text-orange-400"><span className="w-2 h-2 rounded-full mr-2 bg-orange-500"></span>En attente</span>;
      case 'failed':
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-400"><span className="w-2 h-2 rounded-full mr-2 bg-red-500"></span>Échoué</span>;
      default:
        return <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white/10 text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="max-w-[1080px] w-full mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/payments" className="p-2 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Détails de la transaction</h1>
          <p className="text-slate-400 text-sm mt-1">{payment.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Montant Brut</p>
                <h2 className="text-4xl font-bold text-white">{Number(payment.amount || 0).toLocaleString('fr-FR')} {payment.currency}</h2>
              </div>
              {getStatusBadge(payment.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-white/10">
              <div>
                <p className="text-slate-400 text-sm mb-1">Frais Kobara</p>
                <p className="font-bold text-white text-base">-{Number(payment.fee_amount || 0).toLocaleString('fr-FR')} {payment.currency}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm mb-1">Montant Net</p>
                <p className="font-bold text-green-400 text-base">+{Number(payment.net_amount || payment.amount).toLocaleString('fr-FR')} {payment.currency}</p>
              </div>
            </div>
          </div>

          {/* Timeline / Additional details */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-white mb-4">Informations Système</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400 text-sm">Date de création</span>
                <span className="font-bold text-white text-sm">{new Date(payment.created_at).toLocaleString('fr-FR')}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/10">
                <span className="text-slate-400 text-sm">Méthode de paiement</span>
                <span className="font-bold text-white text-sm capitalize">
                  {getPaymentMethodDisplay(payment.payment_method, payment.provider)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-400 text-sm">Référence Kobara</span>
                <span className="font-mono text-white text-sm">{payment.transaction_reference || payment.kobara_reference || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Customer Card */}
          <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-xl font-bold text-white mb-4">Client</h3>
            {customer || payment.metadata?.sender_business_name ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold uppercase">
                    {(customer?.name || payment.metadata?.sender_business_name || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{customer?.name || payment.metadata?.sender_business_name || 'Marchand Kobara'}</p>
                    {(customer?.email || payment.metadata?.sender_email) && <p className="text-slate-400 text-sm">{customer?.email || payment.metadata?.sender_email}</p>}
                  </div>
                </div>
                {customer?.phone && (
                  <div className="pt-3 flex items-center gap-2 text-slate-400 text-sm">
                    <span className="material-symbols-outlined text-[16px]">call</span>
                    {customer.phone}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-400 text-sm">Aucun client rattaché à ce paiement.</p>
            )}
          </div>
          
          {payment.provider !== 'b2b' && <button className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-red-500/20 border border-red-500/20 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/30 transition-colors shadow-sm">
            <span className="material-symbols-outlined text-[18px]">currency_exchange</span>
            Rembourser
          </button>}
        </div>
      </div>
    </div>
  );
}
