import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';
import { syncSubscriptionLifecycle } from '@/lib/server/plans';

export default async function AdminSubscriptionsPage() {
  const supabase = createAdminClient();
  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('*, merchants(id, business_name, email, plan_slug), plans(name, slug)')
    .order('updated_at', { ascending: false });

  async function resync(formData: FormData) {
    'use server';
    const session = await requireAdmin(['super_admin', 'operations']);
    const merchantId = String(formData.get('merchant_id') || '');
    if (!merchantId) throw new Error('Marchand requis');
    const result = await syncSubscriptionLifecycle(merchantId);
    const admin = createAdminClient();
    await admin.from('audit_logs').insert({ admin_id: session.user.id, merchant_id: merchantId, action: 'subscription.resynced', entity_type: 'subscriptions', metadata: { processed: result.processed } });
    revalidatePath('/system-core/subscriptions');
  }

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">ABONNEMENTS</h1><p className="text-sm text-slate-500 mt-1">Échéances, état de paiement et source d’activation.</p></div>
    <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded">
      <table className="min-w-[780px] w-full text-sm"><thead className="bg-slate-950/50 text-xs text-slate-500"><tr><th className="text-left p-4">Marchand</th><th className="text-left p-4">Plan</th><th className="text-left p-4">Statut</th><th className="text-left p-4">Paiement</th><th className="text-left p-4">Échéance</th><th className="p-4"></th></tr></thead>
      <tbody className="divide-y divide-slate-800">{(subscriptions || []).map((s) => <tr key={s.id}><td className="p-4"><div className="font-bold text-white">{s.merchants?.business_name}</div><div className="text-xs text-slate-500">{s.merchants?.email}</div></td><td className="p-4">{s.plans?.name || s.merchants?.plan_slug}</td><td className="p-4 uppercase text-xs">{s.status}</td><td className="p-4 uppercase text-xs">{s.payment_status || '—'} · {s.activation_source || '—'}</td><td className="p-4 text-xs">{s.current_period_end ? new Date(s.current_period_end).toLocaleString('fr-FR') : '—'}</td><td className="p-4 text-right"><form action={resync}><input type="hidden" name="merchant_id" value={s.merchant_id}/><button className="px-3 py-1.5 border border-slate-700 rounded text-xs hover:bg-slate-800">Resynchroniser</button></form></td></tr>)}</tbody></table>
      {(!subscriptions || subscriptions.length === 0) && <p className="p-8 text-center text-slate-500">Aucun abonnement.</p>}
    </div>
  </div>;
}
