import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { getSupportWorkflow } from '@/lib/server/whatsapp/kapso';
import { KNOWLEDGE_NAME } from '@/lib/kapso-support-policy';
import { KnowledgeForm } from './knowledge-form';

export const dynamic = 'force-dynamic';

export default async function SupportKnowledgePage() {
  const session = await requireAdmin(['super_admin']);
  const owner = process.env.KAPSO_KNOWLEDGE_OWNER_ADMIN_ID;
  const allowed = owner ? session.user.id === owner : session.user.email.toLowerCase() === 'lorvensondp4282@gmail.com';
  if (!allowed) return <p role="alert">Cette base est gérée uniquement par le fondateur désigné.</p>;
  let workflow;
  try { workflow = await getSupportWorkflow(); } catch { /* No private provider errors in the page. */ }
  const agent = workflow?.definition?.nodes?.find((node: any) => node.data?.node_type === 'agent');
  const bases = agent?.data?.config?.flow_agent_knowledge_bases;
  const base = bases?.length === 1 && bases[0].name === KNOWLEDGE_NAME ? bases[0] : null;
  return <div className="mx-auto max-w-3xl space-y-6 text-slate-100">
    <Link href="/system-core/whatsapp" className="text-orange-300 underline">WhatsApp</Link>
    <h1 className="text-2xl font-bold">Base de connaissances WhatsApp</h1>
    <p className="text-slate-300">{KNOWLEDGE_NAME}</p>
    {base ? <>
      <p>{base.knowledge_base_text?.trim() ? 'Contenu enregistré dans Kapso' : 'En attente du fichier de Lorvens'} · {workflow.status}</p>
      {workflow.status === 'draft' && <KnowledgeForm version={workflow.lock_version} />}
      <details className="border-t border-slate-700 pt-4"><summary className="cursor-pointer py-2">Contenu actuel</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-4 text-sm">{base.knowledge_base_text || 'Base vide'}</pre></details>
    </> : <p role="alert">Configuration Kapso indisponible. Vérifiez la clé serveur, le projet et le brouillon de support.</p>}
  </div>;
}
