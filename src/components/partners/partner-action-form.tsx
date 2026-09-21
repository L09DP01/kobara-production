'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export function PartnerActionForm({ action, children, submitLabel, className = '' }: {
  action: (formData: FormData) => Promise<{ error?: string; success?: boolean; rawKey?: string }>;
  children: React.ReactNode; submitLabel: string; className?: string;
}) {
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(''); setMessage('');
    const result = await action(new FormData(event.currentTarget));
    setLoading(false);
    if (result.error) setError(result.error); else { setMessage(result.rawKey ? `Clé créée: ${result.rawKey}` : 'Opération terminée.'); event.currentTarget.reset(); }
  }
  return <form onSubmit={submit} className={className}>
    {children}
    {error && <p role="alert" className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    {message && <p className="break-all rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}
    <button disabled={loading} className="flex h-11 items-center justify-center gap-2 rounded-md bg-orange-600 px-5 text-sm font-bold text-white hover:bg-orange-500 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin"/>}{submitLabel}</button>
  </form>;
}
