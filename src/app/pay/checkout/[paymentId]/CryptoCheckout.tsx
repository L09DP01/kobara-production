'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Check, Clock3, Copy, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  getKobaraCryptoCurrency,
  isKobaraCryptoCurrency,
  KOBARA_CRYPTO_CURRENCIES,
  type KobaraCryptoCurrencyId,
} from '@/lib/nowpayments';

interface CryptoCheckoutData {
  providerPaymentId: string;
  payCurrency: KobaraCryptoCurrencyId;
  payAmount: number;
  payAddress: string;
  extraId: string | null;
  network: string | null;
  validUntil: string | null;
  status: string;
}

interface CryptoCheckoutProps {
  paymentId: string;
  reference: string;
  amountUsd: number;
  merchantName: string;
  merchantLogo: string | null;
  accentColor: string;
  initialCurrency: string | null;
  existingCheckout: CryptoCheckoutData | null;
}

function shortAddress(address: string) {
  if (address.length <= 28) return address;
  return `${address.slice(0, 14)}…${address.slice(-10)}`;
}

function secondsUntil(validUntil?: string | null) {
  if (!validUntil) return null;
  const deadline = Date.parse(validUntil);
  return Number.isFinite(deadline)
    ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    : null;
}

export function CryptoCheckout({
  paymentId,
  reference,
  amountUsd,
  merchantName,
  merchantLogo,
  accentColor,
  initialCurrency,
  existingCheckout,
}: CryptoCheckoutProps) {
  const initial = isKobaraCryptoCurrency(initialCurrency) ? initialCurrency : 'usdttrc20';
  const [selectedCurrency, setSelectedCurrency] = useState<KobaraCryptoCurrencyId>(initial);
  const [checkout, setCheckout] = useState<CryptoCheckoutData | null>(existingCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'address' | 'amount' | 'memo' | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(() => secondsUntil(existingCheckout?.validUntil));
  const currency = useMemo(
    () => getKobaraCryptoCurrency(checkout?.payCurrency || selectedCurrency),
    [checkout?.payCurrency, selectedCurrency],
  );

  useEffect(() => {
    if (!checkout?.providerPaymentId) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/status`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (payload?.redirectUrl) window.location.assign(payload.redirectUrl);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [checkout?.providerPaymentId, paymentId]);

  useEffect(() => {
    if (!checkout?.validUntil) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining(secondsUntil(checkout.validUntil));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [checkout?.validUntil]);

  const countdown = secondsRemaining === null
    ? null
    : `${String(Math.floor(secondsRemaining / 60)).padStart(2, '0')}:${String(secondsRemaining % 60).padStart(2, '0')}`;

  const copy = async (value: string, field: 'address' | 'amount' | 'memo') => {
    await navigator.clipboard.writeText(value);
    setCopied(field);
    window.setTimeout(() => setCopied(null), 1600);
  };

  const initialize = async () => {
    if (busy || checkout) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/payments/crypto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, payCurrency: selectedCurrency }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.data) throw new Error(payload?.error || 'Initialisation impossible.');
      const initializedCheckout = payload.data as CryptoCheckoutData;
      setCheckout(initializedCheckout);
      setSecondsRemaining(secondsUntil(initializedCheckout.validUntil));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Initialisation impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-[#080E19] px-4 py-5 text-white sm:px-6 sm:py-8" style={{ '--crypto-accent': accentColor } as CSSProperties}>
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            {merchantLogo ? (
              <img src={merchantLogo} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] font-bold" style={{ color: accentColor }}>
                {merchantName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{merchantName}</p>
              <p className="truncate text-xs text-slate-400">Réf. {reference}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Lock className="h-4 w-4" style={{ color: accentColor }} /> Sécurisé</div>
        </header>

        <section className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">Montant de référence</p>
            <p className="text-3xl font-black">{amountUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base" style={{ color: accentColor }}>USD</span></p>
          </div>
          <p className="text-right text-xs text-slate-400">Taux fixé à la création<br />Crédit net après frais Kobara</p>
        </section>

        <section className="rounded-lg border border-white/10 bg-[#101827] p-4 sm:p-6">
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-300">{error}</div>}

          {!checkout ? (
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-3 text-xs font-bold uppercase text-slate-400">Choisir la crypto et le réseau</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {KOBARA_CRYPTO_CURRENCIES.map((option) => {
                    const active = option.id === selectedCurrency;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedCurrency(option.id)}
                        className={`min-h-16 rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 ${active ? 'bg-white/[0.08]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}
                        style={active ? { borderColor: accentColor } : undefined}
                      >
                        <span className="block text-sm font-bold text-white">{option.symbol}</span>
                        <span className="block text-[11px] text-slate-400">{option.network}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <button type="button" onClick={initialize} disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg font-bold text-white disabled:opacity-50" style={{ backgroundColor: accentColor }}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} Générer l’adresse de paiement
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-start">
              <div className="mx-auto w-full max-w-[220px] rounded-lg bg-white p-4">
                <QRCodeSVG value={checkout.payAddress} size={188} level="M" className="h-auto w-full" />
              </div>
              <div className="min-w-0 space-y-4">
                {countdown && (
                  <div className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${secondsRemaining === 0 ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-amber-500/25 bg-amber-500/10 text-amber-100'}`}>
                    <span className="flex items-center gap-2 text-xs font-semibold"><Clock3 className="h-4 w-4" /> Adresse valide pendant</span>
                    <span className="font-mono text-sm font-bold tabular-nums">{countdown}</span>
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Envoyez exactement</p>
                  <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-all text-xl font-black text-white">{checkout.payAmount} {currency?.symbol}</p>
                    <button type="button" onClick={() => copy(String(checkout.payAmount), 'amount')} aria-label="Copier le montant" className="shrink-0 rounded-md border border-white/10 p-2 text-slate-300 hover:bg-white/10">{copied === 'amount' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">Réseau {currency?.network || checkout.network}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Adresse de dépôt</p>
                  <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#080E19] p-3">
                    <code className="min-w-0 break-all text-xs text-slate-200 sm:hidden">{shortAddress(checkout.payAddress)}</code>
                    <code className="hidden min-w-0 break-all text-xs text-slate-200 sm:block">{checkout.payAddress}</code>
                    <button type="button" onClick={() => copy(checkout.payAddress, 'address')} aria-label="Copier l’adresse" className="shrink-0 rounded-md p-1.5 text-slate-300 hover:bg-white/10">{copied === 'address' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
                  </div>
                </div>
                {checkout.extraId && (
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Memo / Tag obligatoire</p>
                    <div className="mt-1 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <code className="break-all text-xs text-amber-100">{checkout.extraId}</code>
                      <button type="button" onClick={() => copy(checkout.extraId!, 'memo')} aria-label="Copier le memo" className="shrink-0 rounded-md p-1.5 text-amber-100 hover:bg-white/10">{copied === 'memo' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}</button>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-sky-200">
                  <Loader2 className="h-4 w-4 animate-spin" /> {secondsRemaining === 0 ? 'Vérification finale du paiement' : 'En attente de confirmation sur la blockchain'}
                </div>
              </div>
            </div>
          )}
        </section>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Vérifiez toujours la devise et le réseau avant l’envoi</p>
      </div>
    </main>
  );
}
