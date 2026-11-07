import Link from 'next/link';
import { BookOpen, ExternalLink } from 'lucide-react';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSupportWorkflow } from '@/lib/server/whatsapp/kapso';

export const dynamic = 'force-dynamic';

export default async function WhatsAppAdminPage() {
  await requireAdmin(['super_admin', 'operations', 'support']);
  let workflow;
  try { workflow = await getSupportWorkflow(); } catch { /* Do not expose provider errors or credentials. */ }
  return <div className="space-y-6 text-slate-100">
    <header><h1 className="text-2xl font-bold">Support WhatsApp</h1><p className="mt-2 text-slate-300">Kobara · Kapso</p></header>
    <dl className="grid gap-5 border-y border-slate-700 py-5 sm:grid-cols-3">
      <div><dt className="text-sm text-slate-400">Workflow</dt><dd className="mt-1 font-semibold">{workflow ? workflow.status === 'draft' ? 'Brouillon' : workflow.status : 'Indisponible'}</dd></div>
      <div><dt className="text-sm text-slate-400">Modèle</dt><dd className="mt-1 font-semibold">{workflow?.definition?.nodes?.find((node: any) => node.data?.node_type === 'agent')?.data?.config?.provider_model_name || 'Non vérifié'}</dd></div>
      <div><dt className="text-sm text-slate-400">Notifications WhatsApp</dt><dd className="mt-1 font-semibold">Désactivées dans Kobara</dd></div>
    </dl>
    <nav aria-label="Support WhatsApp" className="flex flex-wrap gap-3">
      <a href="https://app.kapso.ai/projects/27701d63-735a-44f3-8982-9a52b22cf1a4/inbox" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded border border-slate-600 px-4 font-semibold"><ExternalLink size={18} aria-hidden="true" />Inbox Kapso</a>
      <Link href="/system-core/whatsapp/knowledge" className="inline-flex min-h-11 items-center gap-2 rounded border border-slate-600 px-4 font-semibold"><BookOpen size={18} aria-hidden="true" />Base de connaissances</Link>
    </nav>
  </div>;
}
