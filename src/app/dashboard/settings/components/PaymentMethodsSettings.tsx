'use client';

import { useState, useTransition } from 'react';
import { CreditCard, Landmark, Smartphone, WalletCards } from 'lucide-react';
import { updatePaymentMethodSetting } from '../actions';
import type { MerchantPaymentMethod, MerchantPaymentMethodState } from '@/lib/server/payments/merchant-payment-methods';

const METHODS: Array<{
  id: MerchantPaymentMethod;
  name: string;
  description: string;
  icon: typeof CreditCard;
}> = [
  { id: 'moncash', name: 'MonCash', description: 'Paiements mobiles en gourdes', icon: Smartphone },
  { id: 'natcash', name: 'NatCash', description: 'Paiements mobiles en gourdes', icon: Smartphone },
  { id: 'card', name: 'Carte bancaire', description: 'Cartes de débit et de crédit', icon: CreditCard },
  { id: 'paypal', name: 'PayPal', description: 'Paiements depuis un compte PayPal', icon: Landmark },
  { id: 'apple_pay', name: 'Apple Pay', description: 'Paiement rapide sur appareils compatibles', icon: WalletCards },
  { id: 'google_pay', name: 'Google Pay', description: 'Paiement rapide sur appareils compatibles', icon: WalletCards },
  { id: 'crypto', name: 'Crypto', description: 'Paiements en actifs numériques', icon: WalletCards },
];

export function PaymentMethodsSettings({ initialState }: { initialState: MerchantPaymentMethodState }) {
  const [state, setState] = useState(initialState);
  const [pendingMethod, setPendingMethod] = useState<MerchantPaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(method: MerchantPaymentMethod) {
    const nextValue = !state.configured[method];
    setPendingMethod(method);
    setError(null);
    startTransition(async () => {
      try {
        const nextState = await updatePaymentMethodSetting(method, nextValue);
        setState(nextState);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Impossible de modifier ce moyen de paiement.');
      } finally {
        setPendingMethod(null);
      }
    });
  }

  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-5 py-5 sm:px-6">
        <h2 className="text-lg font-bold text-white">Moyens de paiement</h2>
        <p className="mt-1 text-sm text-slate-400">Choisissez les options proposées à vos clients sur les liens de paiement et le checkout.</p>
      </div>

      {error && <div role="alert" className="mx-5 mt-5 rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300 sm:mx-6">{error}</div>}

      <div className="divide-y divide-white/10">
        {METHODS.map((method) => {
          const Icon = method.icon;
          const eligible = state.eligible[method.id];
          const checked = state.enabled[method.id];
          const updating = isPending && pendingMethod === method.id;
          return (
            <div key={method.id} className="flex min-h-20 items-center gap-3 px-5 py-4 sm:px-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0F1626] text-slate-300">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white">{method.name}</h3>
                  {!eligible && <span className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Configuration requise</span>}
                </div>
                <p className="mt-0.5 text-xs text-slate-400">{method.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={`${checked ? 'Désactiver' : 'Activer'} ${method.name}`}
                disabled={!eligible || updating}
                onClick={() => toggle(method.id)}
                className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${checked ? 'border-emerald-400/40 bg-emerald-500' : 'border-white/10 bg-slate-700'} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
