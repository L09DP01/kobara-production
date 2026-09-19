import { createAdminClient } from '@/utils/supabase/admin';
import { activateBusinessPlanAction, updateBusinessRequestAction } from './actions';

const labels: Record<string, string> = { new_request: 'Nouvelle', contact_required: 'À contacter', merchant_contacted: 'Contacté', kyb_pending: 'KYB à démarrer', kyb_in_progress: 'KYB en cours', information_required: 'Informations requises', approved: 'KYB approuvé', rejected: 'Refusée', plan_activated: 'Business actif' };

export default async function BusinessRequestsPage() {
  const admin = createAdminClient();
  const { data: requests } = await admin.from('business_plan_requests').select('*, merchants(id, business_name, email, kyc_status, plan_slug)').order('created_at', { ascending: false });
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">DEMANDES BUSINESS</h1><p className="mt-1 text-sm text-slate-500">Contact commercial, suivi KYB et activation administrateur.</p></div>
    <div className="grid gap-4">
      {(requests || []).map((request: any) => <article key={request.id} className="rounded border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-start md:justify-between"><div><h2 className="font-bold text-white">{request.legal_business_name}</h2><p className="text-xs text-slate-500">{request.trading_name} · {request.business_type} · {request.industry}</p></div><span className="w-fit rounded border border-slate-700 px-2 py-1 text-xs font-bold text-orange-400">{labels[request.status] || request.status}</span></div>
        <div className="grid gap-5 py-4 text-sm md:grid-cols-3"><div><p className="text-xs text-slate-500">DEMANDEUR</p><p className="mt-1 text-white">{request.requester_first_name} {request.requester_last_name}</p><p className="text-slate-400">{request.requester_role}</p><p className="text-slate-400">{request.professional_email}</p><p className="text-slate-400">{request.phone}</p></div><div><p className="text-xs text-slate-500">ENTREPRISE</p><p className="mt-1 text-slate-300">{request.business_address}</p><p className="text-slate-400">{request.website_or_social || 'Aucun site indiqué'}</p><p className="mt-2 text-slate-400">{request.business_description}</p></div><div><p className="text-xs text-slate-500">BESOINS</p><p className="mt-1 text-slate-300">{request.desired_payment_methods?.join(', ')}</p><p className="text-slate-400">{request.primary_needs?.join(', ')}</p><p className="mt-2 text-slate-400">{request.additional_message || 'Aucun message'}</p></div></div>
        {request.status !== 'plan_activated' && <form action={updateBusinessRequestAction} className="grid gap-3 border-t border-slate-800 pt-4 md:grid-cols-[220px_1fr_auto]"><input type="hidden" name="id" value={request.id}/><select name="status" defaultValue={request.status === 'new_request' ? 'contact_required' : request.status} className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><option value="contact_required">À contacter</option><option value="merchant_contacted">Marchand contacté</option><option value="kyb_pending">KYB à démarrer</option><option value="kyb_in_progress">KYB en cours</option><option value="information_required">Informations requises</option><option value="approved">Approuver le KYB</option><option value="rejected">Refuser</option></select><input name="admin_notes" defaultValue={request.admin_notes || ''} placeholder="Notes internes" className="rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm"/><button className="rounded border border-slate-700 px-4 py-2 text-sm font-bold hover:bg-slate-800">Mettre à jour</button></form>}
        {request.status === 'approved' && <form action={activateBusinessPlanAction} className="mt-3 text-right"><input type="hidden" name="id" value={request.id}/><button className="rounded bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-500">Activer le plan Business</button></form>}
      </article>)}
      {(!requests || requests.length === 0) && <div className="rounded border border-slate-800 bg-slate-900 p-10 text-center text-slate-500">Aucune demande Business.</div>}
    </div>
  </div>;
}
