'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- PayPal v6 and wallet SDKs do not publish TypeScript browser definitions. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Loader2, Lock } from 'lucide-react';

export type PayPalCheckoutMethod = 'card' | 'paypal' | 'apple_pay' | 'google_pay';

type Eligibility = Record<PayPalCheckoutMethod, boolean>;

interface PayPalExpandedCheckoutProps {
  paymentId: string;
  selectedMethod: PayPalCheckoutMethod;
  onEligibilityChange: (eligibility: Eligibility) => void;
  onError: (message: string | null) => void;
  customerName?: string;
  customerEmail?: string;
}

const BILLING_COUNTRIES = [
  { code: 'US', label: 'États-Unis' },
  { code: 'HT', label: 'Haïti' },
  { code: 'CA', label: 'Canada' },
  { code: 'DO', label: 'République dominicaine' },
  { code: 'FR', label: 'France' },
];

declare global {
  interface Window {
    paypal?: any;
    ApplePaySession?: any;
    google?: any;
  }
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === 'true') return resolve();
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Impossible de charger le service de paiement.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Impossible de charger le service de paiement.'));
    };
    document.head.appendChild(script);
  });
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Le paiement ne peut pas être initialisé.');
  return payload;
}

export function PayPalExpandedCheckout({
  paymentId,
  selectedMethod,
  onEligibilityChange,
  onError,
  customerName = '',
  customerEmail = '',
}: PayPalExpandedCheckoutProps) {
  const [sdk, setSdk] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [cardholderName, setCardholderName] = useState(customerName);
  const [billingEmail, setBillingEmail] = useState(customerEmail);
  const [billingCountry, setBillingCountry] = useState('US');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingRegion, setBillingRegion] = useState('');
  const [billingPostalCode, setBillingPostalCode] = useState('');
  const cardNumberRef = useRef<HTMLDivElement>(null);
  const cardExpiryRef = useRef<HTMLDivElement>(null);
  const cardCvvRef = useRef<HTMLDivElement>(null);
  const walletButtonRef = useRef<HTMLDivElement>(null);
  const cardSessionRef = useRef<any>(null);

  const createOrder = useCallback(async (method: PayPalCheckoutMethod) => {
    const response = await fetch('/api/payments/paypal/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId,
        paymentMethod: method,
        payerName: cardholderName.trim() || customerName.trim(),
        payerEmail: billingEmail.trim() || customerEmail.trim(),
      }),
    });
    return readJson(response);
  }, [paymentId, cardholderName, billingEmail, customerName, customerEmail]);

  const captureOrder = useCallback(async (orderId: string, method: PayPalCheckoutMethod) => {
    const response = await fetch(`/api/payments/paypal/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentId, paymentMethod: method }),
    });
    const payload = await readJson(response);
    window.location.assign(payload.redirectUrl);
  }, [paymentId]);

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        onError(null);
        const response = await fetch(`/api/payments/paypal/config?payment_id=${encodeURIComponent(paymentId)}`, {
          cache: 'no-store',
        });
        const nextConfig = await readJson(response);
        await loadScript('kobara-paypal-v6', nextConfig.sdkUrl);
        await loadScript('kobara-apple-pay', 'https://applepay.cdn-apple.com/jsapi/v1/apple-pay-sdk.js').catch(() => undefined);
        if (!window.paypal?.createInstance) throw new Error('Le module de paiement est indisponible.');

        const baseOptions = {
          clientId: nextConfig.clientId,
          pageType: 'checkout',
          locale: 'fr-FR',
          clientMetadataId: globalThis.crypto?.randomUUID?.(),
        };
        let instance;
        try {
          instance = await window.paypal.createInstance({
            ...baseOptions,
            components: ['card-fields', 'paypal-payments', 'applepay-payments', 'googlepay-payments'],
          });
        } catch (walletInitializationError) {
          console.warn('[Checkout] Optional wallets unavailable', walletInitializationError);
          instance = await window.paypal.createInstance({
            ...baseOptions,
            components: ['card-fields', 'paypal-payments'],
          });
        }
        if (!active) return;

        const methods = instance.findEligibleMethods
          ? await instance.findEligibleMethods({ currencyCode: 'USD' })
          : instance.eligibleMethods;
        const nextEligibility: Eligibility = {
          card: methods?.isEligible?.('advanced_cards') !== false,
          paypal: methods?.isEligible?.('paypal') !== false,
          apple_pay: false,
          google_pay: false,
        };

        if (window.ApplePaySession?.canMakePayments?.()) {
          try {
            await instance.createApplePayOneTimePaymentSession();
            nextEligibility.apple_pay = true;
          } catch {
            nextEligibility.apple_pay = false;
          }
        }

        try {
          await loadScript('kobara-google-pay', 'https://pay.google.com/gp/p/js/pay.js');
          const googleSession = await instance.createGooglePayOneTimePaymentSession();
          const googleConfig = await googleSession.getGooglePayConfig();
          const paymentsClient = new window.google.payments.api.PaymentsClient({
            environment: nextConfig.environment === 'live' ? 'PRODUCTION' : 'TEST',
          });
          const readiness = await paymentsClient.isReadyToPay({
            allowedPaymentMethods: googleConfig.allowedPaymentMethods,
            apiVersion: googleConfig.apiVersion,
            apiVersionMinor: googleConfig.apiVersionMinor,
          });
          nextEligibility.google_pay = readiness.result === true;
        } catch {
          nextEligibility.google_pay = false;
        }

        if (!active) return;
        setConfig(nextConfig);
        setSdk(instance);
        onEligibilityChange(nextEligibility);
        setReady(true);
      } catch (error) {
        if (active) onError(error instanceof Error ? error.message : "Impossible d'initialiser le paiement.");
      }
    }

    initialize();
    return () => { active = false; };
  }, [paymentId, onEligibilityChange, onError]);

  useEffect(() => {
    if (selectedMethod !== 'card') cardSessionRef.current = null;
  }, [selectedMethod]);

  useEffect(() => {
    if (!sdk || selectedMethod !== 'card' || !cardNumberRef.current || cardSessionRef.current) return;
    let disposed = false;
    const numberContainer = cardNumberRef.current;
    const expiryContainer = cardExpiryRef.current;
    const cvvContainer = cardCvvRef.current;
    if (!expiryContainer || !cvvContainer) return;

    async function mountCardFields() {
      try {
        const session = sdk.createCardFieldsOneTimePaymentSession();
        const style = {
          input: { color: '#ffffff', 'font-size': '16px', 'font-family': 'system-ui' },
          '.invalid': { color: '#f87171' },
          ':focus': { color: '#ffffff' },
        };
        const number = session.createCardFieldsComponent({ type: 'number', style, placeholder: 'Numéro de carte' });
        const expiry = session.createCardFieldsComponent({ type: 'expiry', style, placeholder: 'MM/AA' });
        const cvv = session.createCardFieldsComponent({ type: 'cvv', style, placeholder: 'CVV' });
        if (disposed) return;
        numberContainer.appendChild(number);
        expiryContainer!.appendChild(expiry);
        cvvContainer!.appendChild(cvv);
        cardSessionRef.current = session;
      } catch (error) {
        onError(error instanceof Error ? error.message : "Impossible d'afficher les champs de carte.");
      }
    }

    mountCardFields();
    return () => {
      disposed = true;
      numberContainer.replaceChildren();
      expiryContainer.replaceChildren();
      cvvContainer.replaceChildren();
      cardSessionRef.current = null;
    };
  }, [sdk, selectedMethod, onError]);

  useEffect(() => {
    const container = walletButtonRef.current;
    if (!sdk || !config || !container || (selectedMethod !== 'apple_pay' && selectedMethod !== 'google_pay')) return;
    const walletContainer = container;
    let disposed = false;
    let cleanup = () => {};

    async function mountWalletButton() {
      walletContainer.replaceChildren();
      if (selectedMethod === 'apple_pay') {
        const button = document.createElement('apple-pay-button');
        button.setAttribute('buttonstyle', 'black');
        button.setAttribute('type', 'plain');
        button.setAttribute('locale', 'fr-FR');
        button.style.width = '100%';
        button.style.height = '48px';
        const onClick = async () => {
          try {
            setBusy(true);
            onError(null);
            const walletSession = await sdk.createApplePayOneTimePaymentSession();
            const appleConfig = await walletSession.config();
            const order = await createOrder('apple_pay');
            const paymentRequest = {
              countryCode: 'US',
              currencyCode: 'USD',
              merchantCapabilities: appleConfig.merchantCapabilities,
              supportedNetworks: appleConfig.supportedNetworks,
              requiredBillingContactFields: ['name', 'phone', 'email', 'postalAddress'],
              requiredShippingContactFields: [],
              total: { label: 'Kobara', amount: Number(config.amountUsd).toFixed(2), type: 'final' },
            };
            const appleSession = new window.ApplePaySession(4, paymentRequest);
            appleSession.onvalidatemerchant = async (event: any) => {
              try {
                const merchantSession = await walletSession.validateMerchant({ validationUrl: event.validationURL });
                appleSession.completeMerchantValidation(merchantSession.merchantSession || merchantSession);
              } catch (error) {
                appleSession.abort();
                throw error;
              }
            };
            appleSession.onpaymentauthorized = async (event: any) => {
              try {
                await walletSession.confirmOrder({
                  orderId: order.orderId,
                  token: event.payment.token,
                  billingContact: event.payment.billingContact,
                  shippingContact: event.payment.shippingContact,
                });
                appleSession.completePayment({ status: window.ApplePaySession.STATUS_SUCCESS });
                await captureOrder(order.orderId, 'apple_pay');
              } catch (error) {
                appleSession.completePayment({ status: window.ApplePaySession.STATUS_FAILURE });
                onError(error instanceof Error ? error.message : 'Apple Pay a refusé le paiement.');
                setBusy(false);
              }
            };
            appleSession.oncancel = () => setBusy(false);
            appleSession.begin();
          } catch (error) {
            setBusy(false);
            onError(error instanceof Error ? error.message : "Impossible d'ouvrir Apple Pay.");
          }
        };
        button.addEventListener('click', onClick);
        walletContainer.appendChild(button);
        cleanup = () => button.removeEventListener('click', onClick);
        return;
      }

      const walletSession = await sdk.createGooglePayOneTimePaymentSession();
      const googleConfig = await walletSession.getGooglePayConfig();
      const paymentsClient = new window.google.payments.api.PaymentsClient({
        environment: config.environment === 'live' ? 'PRODUCTION' : 'TEST',
        paymentDataCallbacks: {
          onPaymentAuthorized: async (paymentData: any) => {
            try {
              setBusy(true);
              const order = await createOrder('google_pay');
              const confirmation = await walletSession.confirmOrder({
                orderId: order.orderId,
                paymentMethodData: paymentData.paymentMethodData,
              });
              if (confirmation?.status === 'PAYER_ACTION_REQUIRED') {
                if (typeof walletSession.initiatePayerAction !== 'function') {
                  throw new Error("Une authentification bancaire supplémentaire est requise.");
                }
                await walletSession.initiatePayerAction({ orderId: order.orderId });
              }
              await captureOrder(order.orderId, 'google_pay');
              return { transactionState: 'SUCCESS' };
            } catch (error) {
              setBusy(false);
              onError(error instanceof Error ? error.message : 'Google Pay a refusé le paiement.');
              return { transactionState: 'ERROR', error: { reason: 'PAYMENT_DATA_INVALID', message: 'Paiement refusé.', intent: 'PAYMENT_AUTHORIZATION' } };
            }
          },
        },
      });
      const button = paymentsClient.createButton({
        buttonColor: 'black',
        buttonType: 'pay',
        buttonSizeMode: 'fill',
        onClick: () => paymentsClient.loadPaymentData({
          apiVersion: googleConfig.apiVersion,
          apiVersionMinor: googleConfig.apiVersionMinor,
          allowedPaymentMethods: googleConfig.allowedPaymentMethods,
          merchantInfo: googleConfig.merchantInfo,
          callbackIntents: ['PAYMENT_AUTHORIZATION'],
          transactionInfo: {
            countryCode: googleConfig.countryCode || 'US',
            currencyCode: 'USD',
            totalPriceStatus: 'FINAL',
            totalPrice: Number(config.amountUsd).toFixed(2),
          },
        }).catch(() => setBusy(false)),
      });
      if (!disposed) walletContainer.appendChild(button);
    }

    mountWalletButton().catch((error) => onError(error instanceof Error ? error.message : 'Portefeuille indisponible.'));
    return () => {
      disposed = true;
      cleanup();
      walletContainer.replaceChildren();
    };
  }, [sdk, config, selectedMethod, onError, createOrder, captureOrder]);

  const payWithCard = async () => {
    if (!cardSessionRef.current || busy) return;
    const requiredBillingValues = [cardholderName, billingEmail, billingAddress, billingCity, billingPostalCode];
    if (requiredBillingValues.some((value) => !value.trim()) || (billingCountry === 'US' && !billingRegion.trim())) {
      onError('Complétez les informations de facturation. Le ZIP code et l’État sont obligatoires pour une carte américaine.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.trim())) {
      onError('Saisissez une adresse e-mail de facturation valide.');
      return;
    }
    if (billingCountry === 'US' && !/^\d{5}(?:-\d{4})?$/.test(billingPostalCode.trim())) {
      onError('Saisissez un ZIP code américain valide, par exemple 10001.');
      return;
    }
    try {
      setBusy(true);
      onError(null);
      const order = await createOrder('card');
      const result = await cardSessionRef.current.submit(order.orderId, {
        billingAddress: {
          addressLine1: billingAddress.trim(),
          adminArea2: billingCity.trim(),
          ...(billingRegion.trim() ? { adminArea1: billingRegion.trim() } : {}),
          postalCode: billingPostalCode.trim(),
          countryCode: billingCountry,
        },
      });
      if (result?.state !== 'succeeded') throw new Error('La carte n’a pas pu être autorisée.');
      if (result?.data?.liabilityShift === 'NO') throw new Error("L'authentification de la carte a échoué.");
      await captureOrder(order.orderId, 'card');
    } catch (error) {
      setBusy(false);
      onError(error instanceof Error ? error.message : 'Le paiement par carte a échoué.');
    }
  };

  const payWithPayPal = async () => {
    if (!sdk || busy) return;
    try {
      setBusy(true);
      onError(null);
      const session = sdk.createPayPalOneTimePaymentSession({
        onApprove: async (data: any) => captureOrder(data.orderId, 'paypal'),
        onCancel: () => setBusy(false),
        onError: (error: any) => {
          setBusy(false);
          onError(error?.message || 'Le paiement a échoué.');
        },
      });
      const orderPromise = createOrder('paypal').then((order) => ({ orderId: order.orderId }));
      await session.start({ presentationMode: 'auto' }, orderPromise);
    } catch (error) {
      setBusy(false);
      onError(error instanceof Error ? error.message : "Impossible d'ouvrir le paiement.");
    }
  };

  if (!ready) {
    return <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Initialisation sécurisée…</div>;
  }

  if (selectedMethod === 'card') {
    return (
      <div className="space-y-4 border-t border-white/10 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`cardholder-name-${paymentId}`} className="text-xs font-semibold text-slate-300">Nom sur la carte</label>
            <input id={`cardholder-name-${paymentId}`} value={cardholderName} onChange={(event) => setCardholderName(event.target.value)} autoComplete="cc-name" required className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-orange-500" placeholder="Jean Baptiste" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-300">Numéro de carte</label>
            <div className="rounded-lg border border-white/10 bg-[#0A1120] px-3 py-1 focus-within:border-orange-500"><div ref={cardNumberRef} className="h-12" /></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-300">Expiration</label><div className="rounded-lg border border-white/10 bg-[#0A1120] px-3 py-1 focus-within:border-orange-500"><div ref={cardExpiryRef} className="h-12" /></div></div>
          <div className="space-y-1.5"><label className="text-xs font-semibold text-slate-300">Code de sécurité</label><div className="rounded-lg border border-white/10 bg-[#0A1120] px-3 py-1 focus-within:border-orange-500"><div ref={cardCvvRef} className="h-12" /></div></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`billing-email-${paymentId}`} className="text-xs font-semibold text-slate-300">E-mail de facturation</label>
            <input id={`billing-email-${paymentId}`} type="email" value={billingEmail} onChange={(event) => setBillingEmail(event.target.value)} autoComplete="email" inputMode="email" required className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none transition-colors placeholder:text-slate-600 focus:border-orange-500" placeholder="nom@exemple.com" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`billing-country-${paymentId}`} className="text-xs font-semibold text-slate-300">Pays de facturation</label>
            <select id={`billing-country-${paymentId}`} value={billingCountry} onChange={(event) => setBillingCountry(event.target.value)} autoComplete="country" className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none focus:border-orange-500">
              {BILLING_COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`billing-postal-${paymentId}`} className="text-xs font-semibold text-slate-300">{billingCountry === 'US' ? 'ZIP code' : 'Code postal'}</label>
            <input id={`billing-postal-${paymentId}`} value={billingPostalCode} onChange={(event) => setBillingPostalCode(event.target.value)} autoComplete="postal-code" inputMode={billingCountry === 'US' ? 'numeric' : 'text'} required className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-500" placeholder={billingCountry === 'US' ? '10001' : 'Code postal'} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor={`billing-address-${paymentId}`} className="text-xs font-semibold text-slate-300">Adresse de facturation</label>
            <input id={`billing-address-${paymentId}`} value={billingAddress} onChange={(event) => setBillingAddress(event.target.value)} autoComplete="address-line1" required className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-500" placeholder="Numéro et nom de rue" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`billing-city-${paymentId}`} className="text-xs font-semibold text-slate-300">Ville</label>
            <input id={`billing-city-${paymentId}`} value={billingCity} onChange={(event) => setBillingCity(event.target.value)} autoComplete="address-level2" required className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-500" placeholder="Ville" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`billing-region-${paymentId}`} className="text-xs font-semibold text-slate-300">{billingCountry === 'US' ? 'État' : 'Région / Département'}</label>
            <input id={`billing-region-${paymentId}`} value={billingRegion} onChange={(event) => setBillingRegion(event.target.value)} autoComplete="address-level1" required={billingCountry === 'US'} className="h-12 w-full rounded-lg border border-white/10 bg-[#0A1120] px-3 text-base text-white outline-none placeholder:text-slate-600 focus:border-orange-500" placeholder={billingCountry === 'US' ? 'NY' : 'Région'} />
          </div>
        </div>
        <button type="button" onClick={payWithCard} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#F95005] text-sm font-bold text-white transition-colors hover:bg-[#ff6420] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Payer par carte
        </button>
        <p className="text-center text-[10px] leading-4 text-slate-500">Les données de carte sont transmises directement au processeur sécurisé et ne sont jamais stockées par Kobara.</p>
      </div>
    );
  }

  if (selectedMethod === 'paypal') {
    return (
      <button type="button" onClick={payWithPayPal} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#0070e0] text-sm font-bold text-white disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Continuer avec PayPal
      </button>
    );
  }

  return <div ref={walletButtonRef} className="min-h-12 w-full overflow-hidden rounded-lg" />;
}
