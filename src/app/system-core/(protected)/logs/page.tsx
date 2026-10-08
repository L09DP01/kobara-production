import { AlertTriangle, CircleCheck, ScrollText } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SystemLogsPage() {
  await requireAdmin(['super_admin', 'operations', 'support']);
  const admin = createAdminClient();
  const { data: logs } = await admin.from('support_system_logs').select('*, merchants(business_name)').order('created_at', { ascending: false }).limit(250);
  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Observabilité support</p><h1 className="mt-2 text-3xl font-bold text-white">System logs</h1><p className="mt-1 text-sm text-slate-400">Événements sanitisisés utilisés pour diagnostiquer le support, sans secret ni payload sensible.</p></header>
      <nav className="flex flex-wrap gap-5 text-sm text-orange-400"><Link href="/system-core/logs/supabase">Logs Supabase</Link><Link href="/system-core/logs/cloudflare">Logs Cloudflare</Link><Link href="/system-core/health">Santé du système</Link></nav>
      <div className="overflow-x-auto border border-slate-800 bg-slate-900">
        <table className="min-w-[920px] w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-500"><tr><th className="p-4">HEURE</th><th>SÉVÉRITÉ</th><th>SOURCE</th><th>ÉVÉNEMENT</th><th>MARCHAND</th><th>MESSAGE</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {(logs || []).map((log: any) => <tr key={log.id} className="hover:bg-slate-800/40"><td className="p-4 text-slate-500">{new Date(log.created_at).toLocaleString('fr-FR')}</td><td><span className={`inline-flex items-center gap-1 font-bold ${log.level === 'error' || log.level === 'critical' ? 'text-red-400' : log.level === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{log.level === 'info' ? <CircleCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{log.level}</span></td><td className="text-slate-300">{log.source}</td><td className="font-mono text-slate-300">{log.event_type}</td><td className="text-slate-400">{log.merchants?.business_name || '—'}</td><td className="max-w-md whitespace-normal py-3 pr-4 text-slate-400">{log.message}</td></tr>)}
            {!logs?.length && <tr><td colSpan={6} className="p-16 text-center text-slate-500"><ScrollText className="mx-auto mb-2 h-7 w-7" />Aucun événement.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
