'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { BadgeCheck, Check, Circle, KeyRound, Link2, LockKeyhole, Settings2, Store, Webhook } from 'lucide-react';
import type { MerchantSetupGuide } from '@/lib/server/onboarding/merchant-setup';
import { selectIntegrationAction } from '@/app/dashboard/setup-guide/actions';

export function SetupGuide({ guide }: { guide: MerchantSetupGuide }) {
  const [pending, startTransition] = useTransition();
  if (guide.hidden) return null;

  const steps = [guide.steps.profile, guide.steps.kyc, guide.steps.paymentMethods, guide.steps.integration, guide.steps.webhook, guide.steps.firstPayment];
  const completed = steps.filter(Boolean).length;
  const locked = !guide.kycApproved;
  const rows = [
    { key: 'profile', title: 'Compléter le profil de l’entreprise', done: guide.steps.profile, icon: Store, href: '/settings?tab=profile', action: 'Compléter' },
    { key: 'kyc', title: 'Effectuer la vérification KYC', done: guide.steps.kyc, icon: BadgeCheck, href: '/kyc', action: 'Vérifier' },
    { key: 'methods', title: 'Choisir les moyens de paiement', done: guide.steps.paymentMethods, icon: Settings2, locked, href: '/settings?tab=paymentMethods', action: 'Configurer' },
    { key: 'integration', title: 'Créer un lien ou une clé API Live', done: guide.steps.integration, icon: Link2, locked },
    { key: 'webhook', title: guide.integrationChoice === 'api' ? 'Configurer le webhook' : guide.integrationChoice === 'payment_link' ? 'Webhook non requis pour les liens' : 'Configurer le webhook si vous choisissez l’API', done: guide.steps.webhook, icon: Webhook, locked: locked || guide.integrationChoice !== 'api', href: '/webhooks', action: 'Configurer' },
    { key: 'payment', title: 'Recevoir le premier paiement réel', done: guide.steps.firstPayment, icon: Circle, locked, href: '/payment-links', action: 'Encaisser' },
  ];

  return (
    <section className="rounded-lg border border-[#27364B] bg-[#111C2C] p-5 sm:p-6" aria-labelledby="setup-title">
      <div className="flex flex-col gap-3 border-b border-[#27364B] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="setup-title" className="text-lg font-bold text-white">Guide de configuration</h2><p className="mt-1 text-sm text-slate-400">Préparez votre compte pour recevoir vos premiers paiements.</p></div>
        <div className="text-sm font-bold text-orange-400">{completed}/6 terminé</div>
      </div>
      <div className="divide-y divide-[#27364B]">
        {rows.map((row) => {
          const Icon = row.icon;
          return <div key={row.key} className="flex min-h-16 flex-wrap items-center gap-3 py-3">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${row.done ? 'bg-emerald-500/15 text-emerald-400' : row.locked ? 'bg-white/5 text-slate-600' : 'bg-orange-500/10 text-orange-400'}`}>
              {row.done ? <Check className="h-4 w-4" /> : row.locked ? <LockKeyhole className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className={`min-w-0 flex-1 text-sm font-semibold ${row.done ? 'text-slate-500 line-through' : row.locked ? 'text-slate-600' : 'text-slate-200'}`}>{row.title}</span>
            {!row.done && !row.locked && row.key === 'integration' && <div className="flex gap-2"><button disabled={pending} onClick={() => startTransition(async () => { await selectIntegrationAction('payment_link'); })} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white hover:bg-orange-600">Lien</button><button disabled={pending} onClick={() => startTransition(async () => { await selectIntegrationAction('api'); })} className="rounded-lg border border-[#3A4B63] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5"><KeyRound className="mr-1 inline h-3.5 w-3.5" />API</button></div>}
            {!row.done && !row.locked && row.href && row.key !== 'integration' && <Link href={row.href} className="rounded-lg border border-[#3A4B63] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/5">{row.action}</Link>}
          </div>;
        })}
      </div>
    </section>
  );
}
