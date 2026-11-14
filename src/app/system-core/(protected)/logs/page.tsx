import { AlertTriangle, CircleCheck, ScrollText } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import Link from 'next/link';
import { diagnoseLogs } from '@/lib/server/log-diagnostic';

export const dynamic = 'force-dynamic';

export default async function SystemLogsPage({ searchParams }: { searchParams: Promise<{ diagnostic?: string }> }) {
  const query = await searchParams;
  const diagnosticRequested = query.diagnostic === '1';
  if (diagnosticRequested) {
    const session = await requireAdmin(['super_admin', 'operations']);
    return <DiagnosticView adminId={session.user.id} />;
  }
  await requireAdmin(['super_admin', 'operations', 'support']);
  const admin = createAdminClient();
  const { data: logs, error } = await admin.from('support_system_logs').select('id, created_at, level, source, event_type, message, merchants(business_name)').order('created_at', { ascending: false }).limit(250);
  return (
    <div className="space-y-6">
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Observabilité support</p><h1 className="mt-2 text-3xl font-bold text-white">System logs</h1><p className="mt-1 text-sm text-slate-400">Événements sanitisisés utilisés pour diagnostiquer le support, sans secret ni payload sensible.</p></header>
      <nav className="flex flex-wrap gap-5 text-sm text-orange-400"><Link href="/system-core/logs/supabase">Logs Supabase</Link><Link href="/system-core/logs/cloudflare">Logs Cloudflare</Link><Link href="/system-core/health">Santé du système</Link></nav>
      <Link href="/system-core/logs?diagnostic=1" prefetch={false} className="inline-flex min-h-11 items-center gap-2 rounded border border-slate-700 px-3 text-sm text-orange-300"><ScrollText className="h-4 w-4" /> Analyser les journaux</Link>
      <div className="overflow-x-auto border border-slate-800 bg-slate-900">
        <table className="min-w-[920px] w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950 text-slate-500"><tr><th className="p-4">HEURE</th><th>SÉVÉRITÉ</th><th>SOURCE</th><th>ÉVÉNEMENT</th><th>MARCHAND</th><th>MESSAGE</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {(logs || []).map((log: any) => <tr key={log.id} className="hover:bg-slate-800/40"><td className="p-4 text-slate-500">{new Date(log.created_at).toLocaleString('fr-FR')}</td><td><span className={`inline-flex items-center gap-1 font-bold ${log.level === 'error' || log.level === 'critical' ? 'text-red-400' : log.level === 'warning' ? 'text-amber-400' : 'text-emerald-400'}`}>{log.level === 'info' ? <CircleCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}{log.level}</span></td><td className="text-slate-300">{log.source}</td><td className="font-mono text-slate-300">{log.event_type}</td><td className="text-slate-400">{log.merchants?.business_name || '—'}</td><td className="max-w-md whitespace-normal py-3 pr-4 text-slate-400">{log.message}</td></tr>)}
            {!logs?.length && <tr><td colSpan={6} className="p-16 text-center text-slate-400"><ScrollText className="mx-auto mb-2 h-7 w-7" />{error ? 'Journal interne indisponible. Vérifiez la connexion et le schéma Supabase.' : 'Aucun événement.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function DiagnosticView({ adminId }: { adminId: string }) {
  const { data, error } = await createAdminClient().from('support_system_logs').select('level, created_at').order('created_at', { ascending: false }).limit(250);
  const { signals, advice } = await diagnoseLogs(adminId, error ? null : data);
  return <section className="space-y-4">
    <Link href="/system-core/logs" className="text-sm text-orange-400">Retour aux journaux</Link>
    <h1 className="text-2xl font-bold">Diagnostic des journaux</h1>
    <p className="text-sm text-slate-400">Échantillon de la dernière heure. L’absence de signal ne prouve pas que le service fonctionne.</p>
    <ul className="divide-y divide-slate-800 border-y border-slate-800">
      {signals.map(signal => <li key={signal.source} className="py-3 text-sm">
        <strong>{signal.source}</strong>{' : '}
        {signal.state === 'unconfigured' ? 'Non configuré' : signal.state === 'error' ? 'Journal indisponible' :
          `${signal.sampled} entrées lues, ${signal.critical} critiques, ${signal.errors} erreurs, ${signal.warnings} avertissements`}
      </li>)}
    </ul>
    <h2 className="font-bold">Analyse IA</h2>
    <p className="whitespace-pre-line break-words text-sm text-slate-300">{advice || 'Aucune synthèse IA disponible pour cet échantillon.'}</p>
  </section>;
}
