import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { LifeBuoy, MessageSquare, Clock } from "lucide-react";

export default async function AdminSupportPage() {
  const supabase = createAdminClient();

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select(`
      *,
      merchants ( business_name )
    `)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight">SUPPORT DESK</h1>
        <div className="bg-red-500/10 text-red-500 px-3 py-1 rounded border border-red-500/20 text-xs font-bold">
          {tickets?.filter(t => t.status === 'open' || t.status === 'pending_admin').length || 0} REQUIRES ATTENTION
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">TICKET ID</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">MERCHANT</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">SUBJECT</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">STATUS</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {tickets?.map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-mono text-slate-200">#{t.id.split('-')[0]}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(t.created_at).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-300">{t.merchants?.business_name || 'Unknown'}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-medium text-slate-200 max-w-[300px] truncate">{t.subject}</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold">PRIORITY: {t.priority}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                    t.status === 'closed' ? 'bg-slate-800 text-slate-400 border border-slate-700' :
                    t.status === 'open' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    {t.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link 
                    href={`/system-core/support/${t.id}`}
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-xs font-bold transition-colors border border-slate-700"
                  >
                    <MessageSquare className="w-3 h-3" /> REPLY
                  </Link>
                </td>
              </tr>
            ))}
            {(!tickets || tickets.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <LifeBuoy className="w-6 h-6 opacity-20" />
                    <p>No support tickets found.</p>
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
