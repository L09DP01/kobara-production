'use client';

import { useActionState } from 'react';
import { Upload } from 'lucide-react';
import { importSupportKnowledge } from './actions';

export function KnowledgeForm({ version }: { version: number }) {
  const [state, action, pending] = useActionState(importSupportKnowledge, { success: false, message: '' });
  return <form action={action} className="space-y-5">
    <input type="hidden" name="version" value={version} />
    <div><label htmlFor="knowledge-file" className="mb-2 block font-semibold">Fichier officiel (.txt ou .md, UTF-8, 256 Ko maximum)</label>
      <input id="knowledge-file" name="knowledge" type="file" accept=".txt,.md,text/plain,text/markdown" required disabled={pending} className="block w-full rounded border border-slate-600 p-3 text-sm" /></div>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="approved" required disabled={pending} className="mt-1" />Je confirme que ce contenu est validé par Lorvens et ne contient ni données personnelles ni secrets. Il remplacera le contenu actuel.</label>
    {state.message && <p role={state.success ? 'status' : 'alert'} className={state.success ? 'text-emerald-300' : 'text-red-300'}>{state.message}</p>}
    <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center gap-2 rounded bg-orange-600 px-4 font-semibold text-white disabled:opacity-50"><Upload size={18} aria-hidden="true" />{pending ? 'Import en cours...' : 'Remplacer la base'}</button>
  </form>;
}
