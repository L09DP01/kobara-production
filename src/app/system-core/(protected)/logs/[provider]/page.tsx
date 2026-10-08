import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { readProviderLogs } from '@/lib/server/observability';

export const dynamic = 'force-dynamic';

export default async function ProviderLogsPage({ params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== 'supabase' && provider !== 'cloudflare') notFound();
  const logs = await readProviderLogs(provider);
  return <div className="space-y-5">
    <header className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white">Logs {provider === 'supabase' ? 'Supabase' : 'Cloudflare'}</h1><p className="mt-2 text-sm text-slate-300">{logs.detail}</p></div><a href={`/system-core/logs/${provider}`} aria-label="Actualiser les logs" title="Actualiser" className="p-3 border border-slate-700 rounded"><RefreshCw className="h-4 w-4" /></a></header>
    <nav className="flex gap-5 text-sm text-orange-400"><Link href="/system-core/logs">Logs application</Link><Link href="/system-core/logs/supabase">Supabase</Link><Link href="/system-core/logs/cloudflare">Cloudflare</Link><Link href="/system-core/health">Santé du système</Link></nav>
    <div className={`p-3 border text-sm ${logs.state === 'ok' ? 'border-emerald-900 text-emerald-300' : 'border-amber-800 text-amber-300'}`}>{logs.state === 'ok' ? `${logs.rows.length} événements chargés` : logs.state === 'unconfigured' ? 'Non configuré' : 'Indisponible'}</div>
    <div className="overflow-x-auto border border-slate-800"><table className="w-full min-w-[700px] text-left text-xs"><thead className="bg-slate-900 text-slate-300"><tr><th className="p-4">Heure</th><th>Service</th><th>Niveau</th><th>Message</th></tr></thead><tbody className="divide-y divide-slate-800">{logs.rows.map(row => <tr key={row.id}><td className="p-4 text-slate-400">{row.time}</td><td className="pr-4">{row.source}</td><td className="pr-4 text-orange-300">{row.level}</td><td className="py-3 pr-4 whitespace-pre-wrap break-all text-slate-300">{row.message}</td></tr>)}{!logs.rows.length && <tr><td colSpan={4} className="p-12 text-center text-slate-400">{logs.state === 'ok' ? 'Aucun événement dans cette période.' : 'La connexion fournisseur est nécessaire pour consulter les événements.'}</td></tr>}</tbody></table></div>
  </div>;
}
