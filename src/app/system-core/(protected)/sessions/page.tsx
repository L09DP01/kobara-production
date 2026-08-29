import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/utils/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';

export default async function AdminSessionsPage() {
  const supabase = createAdminClient();
  const { data: sessions } = await supabase
    .from('merchant_sessions')
    .select('id, merchant_id, user_email, user_role, ip_address, device_name, browser, operating_system, location, login_method, status, is_active, revoked_at, expires_at, last_active_at, merchants(business_name)')
    .order('last_active_at', { ascending: false })
    .limit(250);

  async function revoke(formData: FormData) {
    'use server';
    const adminSession = await requireAdmin(['super_admin', 'operations']);
    const sessionId = String(formData.get('session_id') || '');
    const admin = createAdminClient();
    const { data: revoked, error } = await admin
      .from('merchant_sessions')
      .update({ status: 'revoked', is_active: false, revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('is_active', true)
      .select('id, merchant_id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (revoked) {
      await admin.from('audit_logs').insert({
        admin_id: adminSession.user.id,
        merchant_id: revoked.merchant_id,
        action: 'session.revoked_by_admin',
        entity_type: 'merchant_sessions',
        entity_id: revoked.id,
      });
    }
    revalidatePath('/system-core/sessions');
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">SESSIONS & APPAREILS</h1><p className="text-sm text-slate-500 mt-1">Historique récent des connexions web et mobiles.</p></div>
      <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/50 text-xs text-slate-500"><tr><th className="text-left p-4">Marchand / utilisateur</th><th className="text-left p-4">Appareil</th><th className="text-left p-4">Réseau</th><th className="text-left p-4">Activité</th><th className="text-left p-4">Statut</th><th className="p-4"></th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {(sessions || []).map((session) => {
              const active = session.is_active !== false && !session.revoked_at && (!session.expires_at || new Date(session.expires_at) > new Date());
              const merchant = Array.isArray(session.merchants) ? session.merchants[0] : session.merchants;
              return <tr key={session.id}>
                <td className="p-4"><div className="font-bold text-white">{merchant?.business_name || 'Inconnu'}</div><div className="text-xs text-slate-500">{session.user_email || '—'} · {session.user_role || '—'}</div></td>
                <td className="p-4"><div>{session.device_name || session.operating_system || 'Appareil inconnu'}</div><div className="text-xs text-slate-500">{session.browser || 'Application'} · {session.login_method}</div></td>
                <td className="p-4 text-xs"><div>{session.ip_address || '—'}</div><div className="text-slate-500">{session.location || '—'}</div></td>
                <td className="p-4 text-xs">{session.last_active_at ? new Date(session.last_active_at).toLocaleString('fr-FR') : '—'}</td>
                <td className={`p-4 text-xs font-bold ${active ? 'text-green-400' : 'text-slate-500'}`}>{active ? 'ACTIVE' : 'RÉVOQUÉE / EXPIRÉE'}</td>
                <td className="p-4 text-right">{active && <form action={revoke}><input type="hidden" name="session_id" value={session.id}/><button className="text-xs text-red-400 border border-red-900/50 px-3 py-1.5 rounded">Révoquer</button></form>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
