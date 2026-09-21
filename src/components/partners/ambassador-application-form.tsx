'use client';

import { useState } from 'react';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';
import { submitAmbassadorApplication } from '@/app/partnership/ambassador/actions';

const field = 'h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-orange-500';
const area = `${field} h-24 py-3`;
export function AmbassadorApplicationForm() {
  const [token, setToken] = useState(''); const [state, setState] = useState<{error?:string;success?:boolean}>({});
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); data.set('turnstile_token', token); const result = await submitAmbassadorApplication(data); setState(result); if (result.success) event.currentTarget.reset(); }
  if (state.success) return <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-6 text-emerald-200"><h2 className="text-xl font-bold">Demande reçue</h2><p className="mt-2">L’équipe Kobara vous contactera après examen. Aucun compte Ambassadeur n’est activé automatiquement.</p></div>;
  return <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
    <h2 className="text-xl font-bold md:col-span-2">Informations du demandeur</h2>
    <input name="first_name" required placeholder="Prénom" className={field}/><input name="last_name" required placeholder="Nom" className={field}/><input name="job_title" required placeholder="Fonction dans l’entreprise" className={field}/><input name="email" type="email" required placeholder="E-mail professionnel" className={field}/><input name="phone" required placeholder="Numéro de téléphone" className={field}/>
    <h2 className="mt-4 text-xl font-bold md:col-span-2">Informations sur l’entreprise</h2>
    <input name="legal_company_name" required placeholder="Nom légal" className={field}/><input name="trading_name" placeholder="Nom commercial" className={field}/><input name="business_type" required placeholder="Type d’entreprise" className={field}/><input name="business_address" required placeholder="Adresse" className={field}/><input name="website_or_social" placeholder="Site internet ou réseaux sociaux" className={field}/><input name="industry" required placeholder="Secteur d’activité" className={field}/><textarea name="experience" required placeholder="Description détaillée de l’activité" className={`${area} md:col-span-2`}/><textarea name="products_services" required placeholder="Produits ou services proposés" className={`${area} md:col-span-2`}/>
    <h2 className="mt-4 text-xl font-bold md:col-span-2">Besoins commerciaux</h2>
    <fieldset className="rounded-md border border-slate-700 p-4 md:col-span-2"><legend className="px-2 text-sm text-slate-300">Moyens de paiement souhaités</legend><div className="flex flex-wrap gap-4">{['MonCash','NatCash','Crypto','Carte','PayPal'].map(v => <label key={v} className="flex gap-2"><input type="checkbox" name="desired_payment_methods" value={v}/>{v}</label>)}</div></fieldset>
    <input name="primary_need" required placeholder="Besoin principal" className={`${field} md:col-span-2`}/><textarea name="message" placeholder="Informations supplémentaires" className={`${area} md:col-span-2`}/>
    <div className="md:col-span-2"><TurnstileWidget onVerify={setToken} onExpire={() => setToken('')} onError={() => setToken('')}/></div>
    {state.error && <p role="alert" className="rounded-md bg-red-500/10 p-3 text-sm text-red-300 md:col-span-2">{state.error}</p>}
    <button className="h-12 rounded-md bg-orange-600 font-bold md:col-span-2">Envoyer ma demande</button>
  </form>;
}
