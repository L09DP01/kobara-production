import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { updateShopifyPrivacyRequest } from './actions';

export default async function ShopifyPrivacyPage() {
  const session = await requireAdmin(['super_admin', 'compliance']);
  const db = createAdminClient();
  const { data: requests, error } = await db.from('shopify_privacy_requests')
    .select('id, shop_domain, topic, status, created_at, due_at, assigned_to, completion_reference')
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw new Error('Registre Shopify indisponible. Vérifiez la migration.');
  const logged = await db.from('audit_logs').insert({ admin_id: session.user.id, action: 'shopify_privacy.list_viewed',
    entity_type: 'shopify_privacy_requests', metadata: { count: requests?.length || 0 } });
  if (logged.error) throw new Error('Journalisation indisponible.');
  const labels: Record<string, string> = { pending: 'À traiter', in_progress: 'En cours', completed: 'Terminée' };
  return <div className="space-y-6">
    <h1 className="text-2xl font-bold">Confidentialité Shopify</h1>
    <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm">
      <thead><tr>{['Boutique', 'Demande', 'Statut', 'Échéance', 'Traitement'].map(label => <th key={label} className="border-b border-slate-700 p-3">{label}</th>)}</tr></thead>
      <tbody>{requests?.map(item => <tr key={item.id} className="border-b border-slate-800">
        <td className="p-3">{item.shop_domain}</td><td className="p-3">{item.topic}</td>
        <td className="p-3">{labels[item.status]}</td><td className="p-3">{new Date(item.due_at).toLocaleDateString('fr-FR')}</td>
        <td className="space-y-3 p-3">{item.status === 'completed' ? item.completion_reference : <>
          <a href={`/api/system-core/shopify-privacy/${item.id}/export`} className="text-orange-400 underline">Exporter le dossier</a>
          <form action={updateShopifyPrivacyRequest} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={item.id} />
            <select name="status" defaultValue="in_progress" aria-label="Statut de traitement" className="rounded border border-slate-700 bg-slate-950 p-2"><option value="in_progress">Prendre en charge</option><option value="completed">Confirmer le traitement effectué</option></select>
            <input name="reference" aria-label="Référence interne du traitement effectué" placeholder="Référence du dossier" maxLength={120} className="rounded border border-slate-700 bg-slate-950 p-2" />
            <button type="submit" className="rounded border border-slate-600 px-3 py-2">Enregistrer</button>
          </form>
        </>}</td>
      </tr>)}</tbody>
    </table>{!requests?.length && <p className="p-4 text-slate-400">Aucune demande.</p>}</div>
  </div>;
}
