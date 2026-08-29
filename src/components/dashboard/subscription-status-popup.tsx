'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock3, X } from 'lucide-react';
import type { SubscriptionEntitlement } from '@/lib/server/subscription-entitlement';

function formatDate(value: string | null) {
  if (!value) return 'date inconnue';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function SubscriptionStatusPopup({ entitlement }: { entitlement?: SubscriptionEntitlement | null }) {
  const shouldShow = Boolean(entitlement?.isGracePeriod || entitlement?.isExpired || entitlement?.reason === 'invalid_period');
  const [isOpen, setIsOpen] = useState(shouldShow);
  if (!isOpen || !entitlement) return null;

  const inGrace = entitlement.isGracePeriod;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="subscription-status-title"
        className="w-full max-w-md rounded-lg border border-amber-500/30 bg-[#101827] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
            {inGrace ? <Clock3 className="h-6 w-6" /> : <AlertTriangle className="h-6 w-6" />}
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fermer"
            title="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <h2 id="subscription-status-title" className="mt-5 text-xl font-bold text-white">
          {inGrace ? 'Votre plan a expiré' : 'Votre abonnement est expiré'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Le plan <strong className="text-white">{entitlement.subscriptionPlan || 'Premium'}</strong> a expiré depuis le{' '}
          <strong className="text-white">{formatDate(entitlement.currentPeriodEnd)}</strong>.
        </p>

        {inGrace ? (
          <div className="mt-4 rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
            Kobara vous accorde exceptionnellement cinq jours pour renouveler. Vos fonctionnalités restent disponibles jusqu’au{' '}
            <strong>{formatDate(entitlement.gracePeriodEnd)}</strong>.
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-red-500/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            Le délai de grâce est terminé. Votre compte utilise maintenant le plan gratuit.
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-11 flex-1 rounded-md border border-white/10 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
          >
            Plus tard
          </button>
          <Link
            href="/dashboard/billing"
            className="flex h-11 flex-1 items-center justify-center rounded-md bg-[#FF4A1C] px-4 text-sm font-bold text-white transition-colors hover:bg-[#E63E13]"
          >
            Renouveler
          </Link>
        </div>
      </div>
    </div>
  );
}
