'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, LockKeyhole, Mail } from 'lucide-react';

export function PartnerLoginForm({ role }: { role: 'developer' | 'ambassador' }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    const form = new FormData(event.currentTarget);
    const result = await signIn('credentials', { email: form.get('email'), password: form.get('password'), redirect: false });
    if (result?.error) { setError('E-mail ou mot de passe incorrect.'); setLoading(false); return; }
    router.push(`/${role}/portal`);
    router.refresh();
  }
  return <form onSubmit={submit} className="space-y-5">
    {error && <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <label className="block text-sm font-semibold text-slate-300">E-mail professionnel
      <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4"><Mail className="h-4 w-4 text-slate-500"/><input name="email" type="email" required autoComplete="email" className="h-12 w-full bg-transparent outline-none"/></span>
    </label>
    <label className="block text-sm font-semibold text-slate-300">Mot de passe
      <span className="mt-2 flex items-center gap-3 rounded-md border border-slate-700 bg-slate-950 px-4"><LockKeyhole className="h-4 w-4 text-slate-500"/><input name="password" type="password" required autoComplete="current-password" className="h-12 w-full bg-transparent outline-none"/></span>
    </label>
    <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-orange-600 font-bold text-white hover:bg-orange-500 disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin"/>}Se connecter</button>
  </form>;
}
