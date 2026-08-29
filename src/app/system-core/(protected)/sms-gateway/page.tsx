import { supabaseAdmin } from "@/lib/supabase/admin";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata = {
  title: "SMS Gateway NatCash - Administration",
};

export default async function AdminSmsGatewayPage() {
  const { data: smsList } = await supabaseAdmin
    .from('sms_inbox')
    .select('*, payments(id, reference_code, amount, status, merchants(business_name))')
    .order('created_at', { ascending: false })
    .limit(100);

  async function manualValidateSMS(formData: FormData) {
    "use server";
    const smsId = formData.get('smsId') as string;
    const paymentId = formData.get('paymentId') as string;

    if (!smsId || !paymentId) return;
    const session = await requireAdmin(['super_admin', 'operations']);

    const { data: result, error: reconcileError } = await supabaseAdmin.rpc('admin_reconcile_sms', {
      p_sms_id: smsId,
      p_payment_id: paymentId,
      p_admin_id: session.user.id,
    });
    if (reconcileError) throw new Error(reconcileError.message);

    if (!result?.already_processed) {
      const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
      await onPaymentSucceeded(paymentId);
    }

    revalidatePath('/system-core/sms-gateway');
  }

  async function ignoreSMS(formData: FormData) {
    "use server";
    const smsId = formData.get('smsId') as string;
    if (!smsId) return;
    const session = await requireAdmin(['super_admin', 'operations']);

    const { data: sms, error } = await supabaseAdmin.from('sms_inbox').update({
      status: 'ignored',
      error_reason: 'Ignoré manuellement par admin'
    }).eq('id', smsId).in('status', ['pending', 'failed']).select('id').maybeSingle();
    if (error) throw new Error(error.message);
    if (sms) {
      await supabaseAdmin.from('audit_logs').insert({
        admin_id: session.user.id,
        action: 'payment.sms_ignored',
        entity_type: 'sms_inbox',
        entity_id: smsId,
      });
    }

    revalidatePath('/system-core/sms-gateway');
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Passerelle SMS NatCash</h1>
          <p className="text-slate-400">Supervision et Rapprochement Manuel</p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl shadow-sm border border-slate-800 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-800">
                <th className="py-3 px-4 text-xs font-semibold text-slate-400 uppercase">Heure</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Statut</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Expéditeur</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Montant</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Code SMS</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Message & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {smsList && smsList.length > 0 ? (
                smsList.map((sms) => {
                  const parsed = sms.parsed_json || {};
                  return (
                    <tr key={sms.id} className="hover:bg-slate-800/50 border-b border-slate-800/50">
                      <td className="py-3 px-4 text-sm whitespace-nowrap text-slate-300">
                        {format(new Date(sms.created_at), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {sms.status === 'processed' && <span className="px-2 py-1 rounded bg-green-500/20 text-green-400 text-xs border border-green-500/30">Validé</span>}
                        {sms.status === 'pending' && <span className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs border border-orange-500/30">En attente</span>}
                        {sms.status === 'failed' && <span className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs border border-red-500/30">Échec</span>}
                        {sms.status === 'ignored' && <span className="px-2 py-1 rounded bg-slate-500/20 text-slate-400 text-xs border border-slate-500/30">Ignoré</span>}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-200">
                        {parsed.senderName || 'Inconnu'}<br/>
                        <span className="text-xs text-slate-400">{parsed.senderPhone || '-'}</span>
                      </td>
                      <td className="py-3 px-4 text-sm font-bold text-slate-200">
                        {parsed.amount ? `${parsed.amount.toLocaleString('fr-FR')} HTG` : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-200">
                        {parsed.referenceCode ? (
                          <span className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">{parsed.referenceCode}</span>
                        ) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-xs text-slate-400 mb-2 whitespace-pre-wrap">
                          {sms.raw_message}
                        </div>
                        {sms.error_reason && (
                          <div className="text-xs text-red-400 mb-2">{sms.error_reason}</div>
                        )}
                        
                        {(sms.status === 'failed' || sms.status === 'pending') && (
                          <div className="flex flex-col gap-2 p-3 bg-slate-800/30 rounded border border-slate-700">
                            <form action={manualValidateSMS} className="flex gap-2 items-center">
                              <input type="hidden" name="smsId" value={sms.id} />
                              <input 
                                type="text" 
                                name="paymentId" 
                                placeholder="ID Paiement (UUID)" 
                                required
                                className="text-xs px-3 py-1.5 rounded border border-slate-600 bg-slate-900 w-48 text-slate-200 focus:outline-none focus:border-blue-500"
                              />
                              <button type="submit" className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded">
                                Lier & Valider
                              </button>
                            </form>
                            <form action={ignoreSMS}>
                              <input type="hidden" name="smsId" value={sms.id} />
                              <button type="submit" className="text-xs text-slate-500 hover:text-red-500 underline">
                                Ignorer ce SMS
                              </button>
                            </form>
                          </div>
                        )}
                        {sms.status === 'processed' && sms.payments && (
                          <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                            Lié au paiement: {sms.payments.id.substring(0,8)}... ({sms.payments.merchants?.business_name})
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">Aucun SMS trouvé.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
