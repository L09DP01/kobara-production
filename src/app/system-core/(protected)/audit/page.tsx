import { createAdminClient } from "@/utils/supabase/admin";
import { SearchCode } from "lucide-react";

export default async function AdminAuditPage() {
  const supabase = createAdminClient();

  const { data: logs } = await supabase
    .from('audit_logs')
    .select(`
      *,
      merchants ( business_name ),
      super_admins ( email, name, role )
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">SECURITY AUDIT LOGS</h1>
      
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
        <table className="min-w-[900px] w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">TIMESTAMP</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">ACTION</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">MERCHANT / USER</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">IP & CLIENT</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">METADATA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 font-mono text-xs">
            {logs?.map((l) => (
              <tr key={l.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4 text-slate-400">
                  <div className="text-slate-300">{new Date(l.created_at).toLocaleDateString()}</div>
                  <div className="text-[10px] text-slate-500">{new Date(l.created_at).toLocaleTimeString()}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded font-bold tracking-wider ${
                    l.action.includes('failed') || l.action.includes('error') ? 'bg-red-500/10 text-red-500' :
                    l.action.includes('login') ? 'bg-blue-500/10 text-blue-400' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {l.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300">
                  {l.super_admins ? (
                    <div>
                      <div className="font-semibold text-amber-500">{l.super_admins.name || l.super_admins.email}</div>
                      <div className="text-[10px] text-amber-500/50 uppercase">{l.super_admins.role}</div>
                    </div>
                  ) : l.merchants?.business_name ? (
                    <div>
                      <div className="font-semibold text-slate-200">{l.merchants.business_name}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Merchant</div>
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-amber-500">{l.metadata?.email || 'Super Admin'}</div>
                      <div className="text-[10px] text-amber-500/50 uppercase">System Level</div>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-300 font-bold">{l.ip_address || '0.0.0.0'}</div>
                  <div className="text-[10px] text-slate-500 max-w-[150px] truncate" title={l.user_agent}>{l.user_agent || 'Unknown Client'}</div>
                </td>
                <td className="px-6 py-4 text-slate-500">
                  <pre className="text-[9px] bg-slate-950 p-2 rounded border border-slate-800 max-w-[300px] overflow-x-auto">
                    {JSON.stringify(l.metadata, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
            {(!logs || logs.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <SearchCode className="w-6 h-6 opacity-20" />
                    <p>No audit logs found.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
