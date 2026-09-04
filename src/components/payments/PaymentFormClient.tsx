"use client";

import { useCallback, useState } from "react";
import { Lock, ChevronDown, AlertCircle, ShieldCheck } from "lucide-react";
import { PaymentProviderConfig } from "@/types/payment-provider";
import { normalizePaymAmount } from "@/lib/payment-routing";
import { PayPalExpandedCheckout, type PayPalCheckoutMethod } from "@/app/pay/checkout/[paymentId]/PayPalExpandedCheckout";
import { PaymentBrandMarks } from "@/components/payments/PaymentBrandMarks";

interface PaymentActionResult {
  redirectUrl?: string;
  paymentId?: string;
  paymentMethod?: string;
  error?: string;
}

interface PublicPaymentLink {
  id: string;
  merchant_id: string;
  amount?: number | string | null;
  metadata?: {
    collect_address?: boolean;
    shipping_fee?: number | string | null;
    pass_fees_to_customer?: boolean;
  } | null;
}

export default function PaymentFormClient({ 
  link, 
  processPaymentAction,
  initialError,
  providerConfig,
  transactionFeePercent,
  allowCardPayment = false,
}: { 
  link: PublicPaymentLink,
  processPaymentAction: (formData: FormData) => Promise<PaymentActionResult | void>,
  initialError?: string,
  providerConfig: PaymentProviderConfig,
  transactionFeePercent: number,
  allowCardPayment?: boolean,
}) {
  const moncashAvailable = providerConfig.active_provider === 'bazik'
    ? true
    : providerConfig.paym_moncash_web || providerConfig.paym_moncash_ussd;
  const natcashAvailable = providerConfig.active_provider === 'bazik'
    ? providerConfig.sms_gateway_enabled
    : providerConfig.paym_natcash_web;

  // Selected method in the list: 'card' | 'paypal' | 'moncash' | 'natcash' | 'apple_google_pay'
  const [selectedMethod, setSelectedMethod] = useState<string>(
    allowCardPayment ? 'card' : (moncashAvailable ? 'moncash' : 'natcash')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const [enteredAmount, setEnteredAmount] = useState('');
  const [internationalPaymentId, setInternationalPaymentId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  const productAmount = link.amount ? Number(link.amount) : Number(enteredAmount || 0);
  const shippingFee = link.metadata?.collect_address && link.metadata?.shipping_fee
    ? Number(link.metadata.shipping_fee)
    : 0;
  const linkBaseAmount = productAmount + shippingFee;
  const feesPassedToCustomer = link.metadata?.pass_fees_to_customer === true;
  const unroundedChargeAmount = feesPassedToCustomer
    ? linkBaseAmount / (1 - transactionFeePercent)
    : linkBaseAmount;
  const displayedChargeAmount = selectedMethod === 'natcash' && providerConfig.active_provider === 'paym'
    ? normalizePaymAmount('natcash', unroundedChargeAmount)
    : Number(unroundedChargeAmount.toFixed(2));

  const errorToDisplay = clientError || initialError;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError(null);
    const amountVal = link.amount ? Number(link.amount) : Number((e.currentTarget.elements.namedItem('amount') as HTMLInputElement)?.value || 0);
    if (amountVal < 20) {
      e.preventDefault();
      setClientError("Le montant minimum de paiement est de 20 HTG (requis par la passerelle de paiement).");
      return;
    }
    setIsSubmitting(true);
  };

  const isAppleDevice = /iPhone|iPad|Macintosh/i.test(globalThis.navigator?.userAgent || '');
  const backendProvider = selectedMethod === 'apple_google_pay'
    ? (isAppleDevice ? 'apple_pay' : 'google_pay')
    : selectedMethod;
  const isInternationalMethod = ['card', 'paypal', 'apple_pay', 'google_pay'].includes(backendProvider);
  const internationalMethod = isInternationalMethod ? backendProvider as PayPalCheckoutMethod : null;

  const handleInternationalEligibility = useCallback((eligibility: Record<PayPalCheckoutMethod, boolean>) => {
    if (internationalMethod && !eligibility[internationalMethod]) {
      setClientError('Ce moyen de paiement n’est pas disponible sur cet appareil.');
    }
  }, [internationalMethod]);

  return (
    <form
      action={async (formData) => {
        setIsSubmitting(true);
        formData.set('provider', backendProvider);
        try {
          const result = await processPaymentAction(formData);
          if (result?.error) {
            setClientError(result.error);
            setIsSubmitting(false);
            return;
          }
          if (result?.redirectUrl) {
            window.location.assign(result.redirectUrl);
            return;
          }
          if (result?.paymentId && isInternationalMethod) {
            setInternationalPaymentId(result.paymentId);
            setIsSubmitting(false);
            return;
          }
          setIsSubmitting(false);
        } catch (error) {
          setIsSubmitting(false);
          setClientError(error instanceof Error ? error.message : "Impossible d'initialiser le paiement.");
        }
      }}
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="paymentLinkId" value={link.id} />
      <input type="hidden" name="merchantId" value={link.merchant_id} />
      <input type="hidden" name="provider" value={backendProvider} />
      
      {/* Bannière d'erreur explicite */}
      {errorToDisplay && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-4 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-bold text-red-400 mb-0.5">Échec de l&apos;initialisation</h4>
            <p className="text-xs text-red-300 leading-relaxed">{errorToDisplay}</p>
          </div>
        </div>
      )}
      
      {/* SECTION: Informations Client */}
      <section className="space-y-4 border-b border-white/10 pb-5">
        <h3 className="text-xs font-bold uppercase text-slate-400">Vos informations</h3>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="customerName" className="block text-sm font-semibold text-slate-300">
              Nom complet *
            </label>
            <input 
              type="text" 
              id="customerName" 
              name="customerName" 
              required
              autoComplete="name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Ex. Jean Baptiste"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-orange-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="customerEmail" className="block text-sm font-semibold text-slate-300">E-mail *</label>
            <input
              type="email"
              id="customerEmail"
              name="customerEmail"
              required
              autoComplete="email"
              inputMode="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="nom@exemple.com"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-orange-500"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="customerPhone" className="block text-sm font-semibold text-slate-300">
              Numéro de téléphone *
            </label>
            <input 
              type="tel" 
              id="customerPhone" 
              name="customerPhone" 
              required
              autoComplete="tel"
              inputMode="tel"
              placeholder="Ex. 509 3123 4567"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-orange-500"
            />
          </div>
        </div>
      </section>

      {/* SECTION: Montant Libre si non défini */}
      {!link.amount && (
        <div className="space-y-4 border-b border-white/10 pb-5">
          <div className="space-y-2">
            <label htmlFor="amount" className="block text-sm font-semibold text-slate-300">
              Montant à payer (HTG) *
            </label>
            <input 
              type="number" 
              id="amount" 
              name="amount" 
              required
              step="0.01"
              min="10"
              placeholder="0.00"
              value={enteredAmount}
              onChange={(event) => setEnteredAmount(event.target.value)}
              inputMode="decimal"
              className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-500"
            />
          </div>
        </div>
      )}
      {link.amount && (
        <input type="hidden" name="amount" value={link.amount} />
      )}

      {/* SECTION: Adresse de Livraison */}
      {link.metadata?.collect_address && (
        <div className="space-y-4 border-b border-white/10 pb-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Adresse de livraison</h3>
            <ChevronDown size={16} className="text-slate-400" />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="city" className="block text-xs font-semibold text-slate-400">Ville / Commune *</label>
              <input 
                type="text" 
                id="city" 
                name="city" 
                required
                placeholder="Ex. Port-au-Prince"
                autoComplete="address-level2"
                className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none focus:border-orange-500"
              />
            </div>
            
            <div className="space-y-2">
              <label htmlFor="customerAddress" className="block text-xs font-semibold text-slate-400">Adresse complète *</label>
              <input 
                type="text" 
                id="customerAddress" 
                name="customerAddress" 
                required
                placeholder="Ex. #12, Rue Panaméricaine"
                autoComplete="street-address"
                className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-4 text-base text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Méthode de Paiement en Liste (Format Vertical Radio List) */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase text-slate-400">
          Moyen de paiement
        </h3>

        <div className="grid gap-3 lg:grid-cols-2">
          {/* 1. CARTE BANCAIRE (DÉBIT / CRÉDIT) */}
          {allowCardPayment && (
            <>
            <label 
              onClick={() => setSelectedMethod('card')}
              className={`flex min-h-16 items-center justify-between rounded-lg border p-4 transition-colors cursor-pointer ${
                selectedMethod === 'card'
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'border-white/10 bg-[#0F1626] hover:bg-white/5'
              }`}
            >
              <input type="radio" name="paymentMethod" value="card" checked={selectedMethod === 'card'} onChange={() => setSelectedMethod('card')} className="sr-only" />
              <div className="flex items-center gap-3.5">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedMethod === 'card' ? 'border-blue-500' : 'border-slate-500'
                }`}>
                  {selectedMethod === 'card' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Carte Bancaire</span>
                  <span className="text-[11px] text-slate-400">Débit & Crédit</span>
                </div>
              </div>

              <PaymentBrandMarks method="card" />
            </label>
            {selectedMethod === 'card' && internationalPaymentId && internationalMethod === 'card' && (
              <div className="rounded-lg border border-orange-500/30 bg-[#0A1120] p-4 lg:col-span-2 lg:p-6">
                <PayPalExpandedCheckout paymentId={internationalPaymentId} selectedMethod="card" customerName={customerName} customerEmail={customerEmail} onEligibilityChange={handleInternationalEligibility} onError={setClientError} />
              </div>
            )}
            </>
          )}

          {/* 2. PAYPAL */}
          {allowCardPayment && (
            <>
            <label 
              onClick={() => setSelectedMethod('paypal')}
              className={`flex min-h-16 items-center justify-between rounded-lg border p-4 transition-colors cursor-pointer ${
                selectedMethod === 'paypal'
                  ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                  : 'border-white/10 bg-[#0F1626] hover:bg-white/5'
              }`}
            >
              <input type="radio" name="paymentMethod" value="paypal" checked={selectedMethod === 'paypal'} onChange={() => setSelectedMethod('paypal')} className="sr-only" />
              <div className="flex items-center gap-3.5">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedMethod === 'paypal' ? 'border-blue-500' : 'border-slate-500'
                }`}>
                  {selectedMethod === 'paypal' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">PayPal</span>
                  <span className="text-[11px] text-slate-400">Solde & compte PayPal</span>
                </div>
              </div>

              <PaymentBrandMarks method="paypal" />
            </label>
            {selectedMethod === 'paypal' && internationalPaymentId && internationalMethod === 'paypal' && (
              <div className="rounded-lg border border-orange-500/30 bg-[#0A1120] p-4 lg:col-span-2 lg:p-6">
                <PayPalExpandedCheckout paymentId={internationalPaymentId} selectedMethod="paypal" customerName={customerName} customerEmail={customerEmail} onEligibilityChange={handleInternationalEligibility} onError={setClientError} />
              </div>
            )}
            </>
          )}

          {/* 3. MONCASH */}
          {moncashAvailable && (
            <label 
              onClick={() => setSelectedMethod('moncash')}
              className={`flex min-h-16 items-center justify-between rounded-lg border p-4 transition-colors cursor-pointer ${
                selectedMethod === 'moncash'
                  ? 'border-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                  : 'border-white/10 bg-[#0F1626] hover:bg-white/5'
              }`}
            >
              <input type="radio" name="paymentMethod" value="moncash" checked={selectedMethod === 'moncash'} onChange={() => setSelectedMethod('moncash')} className="sr-only" />
              <div className="flex items-center gap-3.5">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedMethod === 'moncash' ? 'border-orange-500' : 'border-slate-500'
                }`}>
                  {selectedMethod === 'moncash' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">MonCash</span>
                  <span className="text-[11px] text-slate-400">Paiement Mobile Digicel</span>
                </div>
              </div>

              <div className="w-10 h-7 rounded bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                <img src="/moncash.png" alt="MonCash" className="w-full h-full object-contain" />
              </div>
            </label>
          )}

          {/* 4. NATCASH */}
          {natcashAvailable && (
            <label 
              onClick={() => setSelectedMethod('natcash')}
              className={`flex min-h-16 items-center justify-between rounded-lg border p-4 transition-colors cursor-pointer ${
                selectedMethod === 'natcash'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'border-white/10 bg-[#0F1626] hover:bg-white/5'
              }`}
            >
              <input type="radio" name="paymentMethod" value="natcash" checked={selectedMethod === 'natcash'} onChange={() => setSelectedMethod('natcash')} className="sr-only" />
              <div className="flex items-center gap-3.5">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedMethod === 'natcash' ? 'border-emerald-500' : 'border-slate-500'
                }`}>
                  {selectedMethod === 'natcash' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">NatCash</span>
                  <span className="text-[11px] text-slate-400">Paiement Mobile Natcom</span>
                </div>
              </div>

              <div className="w-10 h-7 rounded bg-white p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                <img src="/natcash.png" alt="NatCash" className="w-full h-full object-contain" />
              </div>
            </label>
          )}

          {/* 5. APPLE PAY / GOOGLE PAY (selon l'appareil) */}
          {allowCardPayment && (
            <>
            <label 
              onClick={() => setSelectedMethod('apple_google_pay')}
              className={`flex min-h-16 items-center justify-between rounded-lg border p-4 transition-colors cursor-pointer ${
                selectedMethod === 'apple_google_pay'
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 bg-[#0F1626] hover:bg-white/5'
              }`}
            >
              <input type="radio" name="paymentMethod" value="apple_google_pay" checked={selectedMethod === 'apple_google_pay'} onChange={() => setSelectedMethod('apple_google_pay')} className="sr-only" />
              <div className="flex items-center gap-3.5">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedMethod === 'apple_google_pay' ? 'border-orange-500' : 'border-slate-500'
                }`}>
                  {selectedMethod === 'apple_google_pay' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">{isAppleDevice ? 'Apple Pay' : 'Google Pay'}</span>
                  <span className="text-[11px] text-slate-400">Portefeuilles biométriques 1-Clic</span>
                </div>
              </div>

              <PaymentBrandMarks method={isAppleDevice ? 'apple_pay' : 'google_pay'} />
            </label>
            {selectedMethod === 'apple_google_pay' && internationalPaymentId && internationalMethod && (
              <div className="rounded-lg border border-orange-500/30 bg-[#0A1120] p-4 lg:col-span-2 lg:p-6">
                <PayPalExpandedCheckout paymentId={internationalPaymentId} selectedMethod={internationalMethod} customerName={customerName} customerEmail={customerEmail} onEligibilityChange={handleInternationalEligibility} onError={setClientError} />
              </div>
            )}
            </>
          )}
        </div>
      </section>

      {(!internationalPaymentId || !isInternationalMethod) && (
        <button
          type="submit"
          disabled={isSubmitting || (!moncashAvailable && !natcashAvailable && !allowCardPayment)}
          className="relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#F95005] px-4 text-base font-bold text-white transition-colors hover:bg-[#ff6420] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Lock size={18} />
          <span>
            {isSubmitting
              ? 'Initialisation sécurisée...'
              : isInternationalMethod
                ? 'Continuer'
                : `Payer ${displayedChargeAmount > 0 ? `${displayedChargeAmount.toLocaleString('fr-FR')} HTG` : ''}`}
          </span>
          <div className="absolute right-4 opacity-50 group-hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined font-bold text-[20px]">arrow_forward</span>
          </div>
        </button>
      )}
      
      <div className="flex items-center justify-center gap-2 mt-4 text-slate-500 text-xs font-medium">
        <ShieldCheck size={14} className="text-emerald-400" />
        <span>Paiement sécurisé de bout en bout • Vos données sont protégées.</span>
      </div>
    </form>
  );
}
