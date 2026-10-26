'use client';

import { useActionState, type ReactNode } from 'react';

type ResolutionState = { error: string };

export function KycResolutionForm({ action, children }: {
  action: (previous: ResolutionState, data: FormData) => Promise<ResolutionState>;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, { error: '' });
  return (
    <form action={formAction} className="inline-block max-w-full" aria-busy={pending}>
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0 disabled:opacity-60">
        {children}
      </fieldset>
      {pending && <p role="status" className="mt-2 text-xs text-slate-300">Enregistrement de la décision...</p>}
      {state.error && <p role="alert" className="mt-2 max-w-sm text-sm text-red-300">{state.error}</p>}
    </form>
  );
}
