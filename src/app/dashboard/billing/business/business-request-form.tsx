'use client';

import { useActionState } from 'react';
import { ArrowLeft, Building2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { submitBusinessRequest, type BusinessRequestState } from './actions';

const initialState: BusinessRequestState = { success: false, message: '' };
const fieldClass = 'mt-1.5 w-full rounded-lg border border-white/10 bg-[#0A1322] px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500';

export function BusinessRequestForm({ defaults, request }: { defaults: any; request: any }) {
  const [state, action, pending] = useActionState(submitBusinessRequest, initialState);
  const value = (name: string) => request?.[name] ?? defaults?.[name] ?? '';
  if (state.success) return <div className="mx-auto max-w-xl rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-8 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400"/><h1 className="mt-4 text-xl font-bold text-white">Demande envoyée</h1><p className="mt-2 text-sm text-slate-300">{state.message}</p><Link href="/dashboard/billing" className="mt-6 inline-flex rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white">Retour aux plans</Link></div>;

  return <div className="mx-auto max-w-4xl space-y-6 pb-14">
    <div><Link href="/dashboard/billing" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4"/>Retour</Link><div className="flex items-center gap-3"><Building2 className="h-8 w-8 text-orange-400"/><div><h1 className="text-2xl font-bold text-white">Demander le plan Business</h1><p className="text-sm text-slate-400">Après réception, l’équipe Kobara vous contactera pour démarrer la vérification KYB.</p></div></div></div>
    <form action={action} className="space-y-6">
      <Section title="Informations du demandeur"><Grid>
        <Field name="requester_last_name" label="Nom" defaultValue={value('requester_last_name')}/><Field name="requester_first_name" label="Prénom" defaultValue={value('requester_first_name')}/><Field name="requester_role" label="Fonction dans l’entreprise" defaultValue={value('requester_role')}/><Field name="professional_email" label="E-mail professionnel" type="email" defaultValue={value('professional_email')}/><Field name="phone" label="Numéro de téléphone" defaultValue={value('phone')}/>
      </Grid></Section>
      <Section title="Informations sur l’entreprise"><Grid>
        <Field name="legal_business_name" label="Nom légal" defaultValue={value('legal_business_name')}/><Field name="trading_name" label="Nom commercial" defaultValue={value('trading_name')}/><Field name="business_type" label="Type d’entreprise" defaultValue={value('business_type')} placeholder="Société, entreprise individuelle, ONG..."/><Field name="business_address" label="Adresse de l’entreprise" defaultValue={value('business_address')}/><Field name="website_or_social" label="Site internet ou réseaux sociaux" required={false} defaultValue={value('website_or_social')}/><Field name="industry" label="Secteur d’activité" defaultValue={value('industry')}/><TextArea name="business_description" label="Description détaillée de l’activité" defaultValue={value('business_description')}/><TextArea name="products_services" label="Produits ou services proposés" defaultValue={value('products_services')}/>
      </Grid></Section>
      <Section title="Besoins commerciaux"><div className="space-y-5"><Checks name="desired_payment_methods" label="Moyens de paiement souhaités" options={['MonCash','NatCash','Carte bancaire','PayPal','Crypto']} selected={request?.desired_payment_methods}/><Checks name="primary_needs" label="Besoin principal" options={['Paiements','API','Retraits','B2B','Intégration e-commerce']} selected={request?.primary_needs}/><TextArea name="additional_message" label="Message ou informations supplémentaires" required={false} defaultValue={value('additional_message')}/></div></Section>
      {state.message && <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300">{state.message}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-orange-500 px-5 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-50">{pending ? 'Envoi...' : 'Envoyer la demande Business'}</button>
    </form>
  </div>;
}

function Section({ title, children }: any) { return <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-6"><h2 className="mb-5 text-lg font-bold text-white">{title}</h2>{children}</section>; }
function Grid({ children }: any) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function Field({ name, label, required = true, ...props }: any) { return <label className="text-sm font-semibold text-slate-300">{label}{required && ' *'}<input name={name} required={required} className={fieldClass} {...props}/></label>; }
function TextArea({ name, label, required = true, ...props }: any) { return <label className="block text-sm font-semibold text-slate-300 sm:col-span-2">{label}{required && ' *'}<textarea name={name} required={required} rows={4} className={fieldClass} {...props}/></label>; }
function Checks({ name, label, options, selected = [] }: any) { return <fieldset><legend className="mb-2 text-sm font-semibold text-slate-300">{label} *</legend><div className="flex flex-wrap gap-2">{options.map((option: string) => <label key={option} className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0A1322] px-3 py-2 text-sm text-slate-300"><input type="checkbox" name={name} value={option} defaultChecked={selected?.includes(option)} className="accent-orange-500"/>{option}</label>)}</div></fieldset>; }
