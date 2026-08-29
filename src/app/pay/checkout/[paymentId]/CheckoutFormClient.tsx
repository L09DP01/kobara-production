'use client';

import { useCallback, useMemo, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import type { PaymentProviderConfig } from '@/types/payment-provider';
import { PaymentBrandMarks } from '@/components/payments/PaymentBrandMarks';
import { PayPalExpandedCheckout, type PayPalCheckoutMethod } from './PayPalExpandedCheckout';
import { processUnifiedCheckout } from './actions';

interface Props {
  paymentId: string;
  config: PaymentProviderConfig;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  allowCardPayment?: boolean;
  amountHtg?: number;
  initialMethod?: string;
}

type LocalMethod = 'moncash' | 'natcash';
type CheckoutMethod = LocalMethod | PayPalCheckoutMethod;
type Eligibility = Record<PayPalCheckoutMethod, boolean>;
const initialEligibility: Eligibility = { card: true, paypal: true, apple_pay: false, google_pay: false };

function isPayPalMethod(value: CheckoutMethod): value is PayPalCheckoutMethod {
  return ['card', 'paypal', 'apple_pay', 'google_pay'].includes(value);
}

function initialSelection(value: string | undefined, enabled: boolean): CheckoutMethod {
  if (enabled && ['card', 'paypal', 'apple_pay', 'google_pay'].includes(value || '')) {
    return value as PayPalCheckoutMethod;
  }
  return enabled ? 'card' : 'moncash';
}

export function CheckoutFormClient({
  paymentId,
  config,
  defaultName,
  defaultEmail,
  defaultPhone,
  allowCardPayment = false,
  initialMethod,
}: Props) {
  const isPaym = config.active_provider === 'paym';
  const [selectedMethod, setSelectedMethod] = useState<CheckoutMethod>(() => initialSelection(initialMethod, allowCardPayment));
  const [eligibility, setEligibility] = useState<Eligibility>(initialEligibility);
  const [phone, setPhone] = useState(defaultPhone || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEligibilityChange = useCallback((next: Eligibility) => {
    setEligibility(next);
    setSelectedMethod((current) => isPayPalMethod(current) && !next[current]
      ? (next.card ? 'card' : next.paypal ? 'paypal' : 'moncash')
      : current);
  }, []);
  const onPayPalError = useCallback((message: string | null) => setError(message), []);

  const localMethods = useMemo(() => {
    const methods: Array<{ id: LocalMethod; title: string; subtitle: string; image: string }> = [];
    if (isPaym ? config.paym_moncash_web || config.paym_moncash_ussd : true) {
      methods.push({ id: 'moncash', title: 'MonCash', subtitle: 'Paiement mobile Digicel', image: '/moncash.png' });
    }
    if (isPaym ? config.paym_natcash_web : config.sms_gateway_enabled) {
      methods.push({ id: 'natcash', title: 'NatCash', subtitle: 'Paiement mobile Natcom', image: '/natcash.png' });
    }
    return methods;
  }, [config, isPaym]);

  const isUssd = selectedMethod === 'moncash' && isPaym && config.paym_moncash_ussd && !config.paym_moncash_web;

  const submitLocalPayment = async (formData: FormData) => {
    if (busy || isPayPalMethod(selectedMethod)) return;
    const cleanPhone = phone.replace(/\D/g, '');
    if (isUssd && cleanPhone.length < 8) {
      setError('Veuillez saisir un numéro de téléphone MonCash valide.');
      return;
    }
    formData.set('paymentId', paymentId);
    formData.set('provider', selectedMethod);
    formData.set('methodType', isUssd ? 'ussd' : 'web');
    if (isUssd) formData.set('phoneNumber', cleanPhone);
    setBusy(true);
    setError(null);
    try {
      const result = await processUnifiedCheckout(formData);
      const redirectUrl = result?.redirectUrl;
      if (!redirectUrl) throw new Error(result?.error || "Le fournisseur n'a retourné aucune destination.");
      window.location.assign(redirectUrl);
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : 'Le paiement ne peut pas être initialisé.');
    }
  };

  const paypalOptions: Array<{ id: PayPalCheckoutMethod; title: string; subtitle: string }> = [
    { id: 'card', title: 'Carte bancaire', subtitle: 'Débit ou crédit' },
    { id: 'paypal', title: 'PayPal', subtitle: 'Compte PayPal' },
    { id: 'apple_pay', title: 'Apple Pay', subtitle: 'Disponible sur cet appareil' },
    { id: 'google_pay', title: 'Google Pay', subtitle: 'Disponible sur cet appareil' },
  ];

  return (
    <form action={submitLocalPayment} className="space-y-5">
      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">{error}</div>}
      <fieldset className="space-y-2.5">
        <legend className="mb-3 text-xs font-bold uppercase text-slate-400">Moyen de paiement</legend>
        {allowCardPayment && paypalOptions.map((option) => eligibility[option.id] && (
          <div key={option.id} className={`overflow-hidden rounded-lg border transition-colors ${selectedMethod === option.id ? 'border-orange-500 bg-orange-500/[0.07]' : 'border-white/10 bg-white/[0.02]'}`}>
            <label className="flex min-h-16 cursor-pointer items-center justify-between p-4 hover:bg-white/[0.04]">
              <span className="flex items-center gap-3">
                <input type="radio" name="checkoutMethod" checked={selectedMethod === option.id} onChange={() => setSelectedMethod(option.id)} className="accent-orange-500" />
                <span><strong className="block text-sm text-white">{option.title}</strong><span className="text-[11px] text-slate-400">{option.subtitle}</span></span>
              </span>
              <PaymentBrandMarks method={option.id} />
            </label>
            {selectedMethod === option.id && (
              <div className="border-t border-white/10 bg-[#0A1120] p-4">
                <PayPalExpandedCheckout
                  paymentId={paymentId}
                  selectedMethod={option.id}
                  customerName={defaultName}
                  customerEmail={defaultEmail}
                  onEligibilityChange={onEligibilityChange}
                  onError={onPayPalError}
                />
              </div>
            )}
          </div>
        ))}
        {localMethods.map((option) => (
          <label key={option.id} className={`flex min-h-16 cursor-pointer items-center justify-between rounded-lg border p-4 transition-colors ${selectedMethod === option.id ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
            <span className="flex items-center gap-3">
              <input type="radio" name="checkoutMethod" checked={selectedMethod === option.id} onChange={() => setSelectedMethod(option.id)} className="accent-orange-500" />
              <span><strong className="block text-sm text-white">{option.title}</strong><span className="text-[11px] text-slate-400">{option.subtitle}</span></span>
            </span>
            <span className="flex h-8 w-11 items-center justify-center overflow-hidden rounded bg-white p-1"><img src={option.image} alt="" className="max-h-full max-w-full object-contain" /></span>
          </label>
        ))}
      </fieldset>

      {isUssd && (
        <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <label htmlFor="moncash-phone" className="block text-xs font-semibold text-slate-300">Numéro de téléphone MonCash</label>
          <input id="moncash-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" placeholder="509 3456 7890" className="h-12 w-full rounded-lg border border-white/10 bg-[#0F1626] px-4 text-base text-white outline-none focus:border-orange-500" />
        </div>
      )}

      {!isPayPalMethod(selectedMethod) && (
        <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#F95005] text-sm font-bold text-white hover:bg-[#ff6420] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Continuer
        </button>
      )}
      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Paiement chiffré et sécurisé</div>
    </form>
  );
}
