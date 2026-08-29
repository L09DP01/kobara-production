import { createAdminClient } from "@/utils/supabase/admin";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";

export default async function AdminMerchantsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const supabase = createAdminClient();
  const params = await searchParams;
  const q = String(params.q || '').trim().replace(/[,%()]/g, '');
  const page = Math.max(1, Number(params.page || 1));
  const pageSize = 50;

  let query = supabase
    .from('merchants')
    .select(`
      id,
      business_name,
      email,
      status,
      kyc_status,
      created_at
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (q) query = query.or(`business_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data: merchants, count } = await query;
  const totalPages = Math.max(1, Math.ceil((count || 0) / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">MERCHANT DIRECTORY</h1>
        <form method="get" className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            name="q"
            type="text" 
            defaultValue={q}
            placeholder="Nom ou e-mail..."
            className="w-full bg-slate-900 border border-slate-700 rounded-md pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-red-500 transition-colors text-slate-200"
          />
        </form>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-950/50 border-b border-slate-800 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">IDENTIFIER / BUSINESS</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">COMMUNICATION</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">AUTH STATUS</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs">KYC LEVEL</th>
              <th className="px-6 py-4 font-semibold tracking-wider text-xs text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {merchants?.map(m => (
              <tr key={m.id} className="hover:bg-slate-800/30 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-200">{m.business_name || 'N/A'}</div>
                  <div className="text-xs text-slate-500 font-mono mt-1">{m.id.split('-')[0]}...</div>
                </td>
                <td className="px-6 py-4 text-slate-400 font-mono text-xs">{m.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                    m.status === 'active' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {m.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold tracking-wider ${
                    m.kyc_status === 'approved' ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
                    m.kyc_status === 'in_review' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                    m.kyc_status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                    'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {m.kyc_status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link 
                    href={`/system-core/merchants/${m.id}`}
                    className="inline-flex items-center justify-center p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            ))}
            {(!merchants || merchants.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="w-6 h-6 opacity-20" />
                    <p>No records found in the database.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{count || 0} marchands</span>
        <div className="flex gap-2">
          {page > 1 && <Link className="px-3 py-1.5 border border-slate-700 rounded text-slate-300" href={`/system-core/merchants?q=${encodeURIComponent(q)}&page=${page - 1}`}>Précédent</Link>}
          <span className="px-3 py-1.5">{page}/{totalPages}</span>
          {page < totalPages && <Link className="px-3 py-1.5 border border-slate-700 rounded text-slate-300" href={`/system-core/merchants?q=${encodeURIComponent(q)}&page=${page + 1}`}>Suivant</Link>}
        </div>
      </div>
    </div>
  );
}
