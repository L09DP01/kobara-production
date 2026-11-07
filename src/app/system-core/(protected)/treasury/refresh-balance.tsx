'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function RefreshBalance() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} aria-busy={pending}
    onClick={() => startTransition(() => router.refresh())}
    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60">
    <RefreshCw aria-hidden="true" className={`h-4 w-4 ${pending ? 'animate-spin motion-reduce:animate-none' : ''}`} />
    {pending ? 'Actualisation...' : 'Actualiser'}
  </button>;
}
