'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { registerDeveloper } from '@/app/developer/actions';

const inputClass = 'h-12 w-full rounded-md border border-slate-700 bg-slate-950 px-4 text-white outline-none focus:border-orange-500';

export function DeveloperRegisterForm() {
  const router = useRouter(); const [token, setToken] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setLoading(true); setError(''); const data = new FormData(event.currentTarget); data.set('turnstile_token', token); const result = await registerDeveloper(data); setLoading(false); if (result.error) setError(result.error); else router.push('/developer/login?registered=true'); }
  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm text-slate-300">Prénom<input name="first_name" required className={inputClass}/></label><label className="text-sm text-slate-300">Nom<input name="last_name" required className={inputClass}/></label>
    <label className="text-sm text-slate-300 sm:col-span-2">Entreprise ou agence<input name="company_name" className={inputClass}/></label>
    <label className="text-sm text-slate-300 sm:col-span-2">E-mail professionnel<input name="email" type="email" required className={inputClass}/></label>
    <label className="text-sm text-slate-300">Téléphone<input name="phone" className={inputClass}/></label><label className="text-sm text-slate-300">Site internet<input name="website_url" type="url" className={inputClass}/></label>
    <label className="text-sm text-slate-300 sm:col-span-2">Mot de passe<input name="password" type="password" minLength={8} required className={inputClass}/></label>
    <div className="sm:col-span-2"><TurnstileWidget onVerify={setToken} onExpire={() => setToken('')} onError={() => setToken('')}/></div>
    {error && <p role="alert" className="sm:col-span-2 rounded-md bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <button disabled={loading} className="h-12 rounded-md bg-orange-600 font-bold sm:col-span-2 disabled:opacity-60">{loading ? 'Création...' : 'Créer mon compte Developer'}</button>
  </form>;
}
