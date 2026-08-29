'use client'

import { useState } from 'react';
import { requestWithdrawal, sendWithdrawalOtpAction } from './actions';
import { executeB2BTransfer } from './b2b-actions';
import { useEnvironment } from '@/context/EnvironmentContext';
import { QRCodeSVG } from 'qrcode.react';
import { calculateWithdrawalQuote } from '@/lib/withdrawal-currency';

function getWithdrawalMethodDisplay(methodOrProvider?: string | null): string {
  if (!methodOrProvider) return 'MonCash';
  const val = methodOrProvider.toLowerCase().trim();
  if (val.includes('natcash') || val.includes('nat_cash')) return 'NatCash';
  if (val.includes('moncash') || val.includes('mon_cash')) return 'MonCash';
  if (val.includes('zelle')) return 'Zelle';
  if (val.includes('paypal')) return 'PayPal';
  if (val.includes('b2b')) return 'Transfert B2B';
  return 'MonCash';
}

function formatWithdrawalAmount(value: number | string | null | undefined, currency?: string | null): string {
  const amount = Number(value || 0);
  return currency === 'USD'
    ? amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} HTG`;
}

export function WithdrawalsClient({
  withdrawals,
  merchant,
  twoFactorMethod = 'none',
  userEmail = '',
  savedMoncashNumber = '',
  exchangeRate = 130,
  usdAccountActive = false,
}: {
  withdrawals: any[],
  merchant: any,
  twoFactorMethod?: 'none' | 'email' | 'totp',
  userEmail?: string,
  savedMoncashNumber?: string,
  exchangeRate?: number,
  usdAccountActive?: boolean
}) {
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<any>(null);
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [amount, setAmount] = useState<number | ''>('');
  const [method, setMethod] = useState('MonCash');
  const [accountCurrency, setAccountCurrency] = useState<'HTG' | 'USD'>('HTG');
  const [receiver, setReceiver] = useState(savedMoncashNumber);
  const [saveNumber, setSaveNumber] = useState(false);
  const [code2fa, setCode2fa] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const { currentEnvironment } = useEnvironment();

  const isTest = currentEnvironment === 'test';
  const activeHtgBalance = isTest
    ? Number(merchant.available_balance_test || 0)
    : Number(merchant.available_balance || 0);
  const activeUsdBalance = isTest
    ? Number(merchant.available_balance_usd_test || 0)
    : Number(merchant.available_balance_usd || 0);
  const isUsdMethod = method === 'Zelle' || method === 'PayPal';
  const selectedCurrency = accountCurrency;
  const activeBalance = accountCurrency === 'USD' ? activeUsdBalance : activeHtgBalance;
  const quote = calculateWithdrawalQuote({ amount: Number(amount || 0), method, sourceCurrency: accountCurrency, exchangeRate });
  const { payoutCurrency, feeRate, payoutAmount: estimatedPayout } = quote;

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Saisissez un montant supérieur à zéro.');
      return;
    }
    if (method === 'B2B' && accountCurrency !== 'HTG') {
      setErrorMsg('Les transferts B2B utilisent actuellement le compte HTG.');
      return;
    }
    if (method !== 'B2B' && ((payoutCurrency === 'USD' && estimatedPayout < 10) || (payoutCurrency === 'HTG' && estimatedPayout < 150))) {
      setErrorMsg(payoutCurrency === 'USD' ? 'Le montant net reçu doit être d’au moins 10 USD.' : 'Le montant net reçu doit être d’au moins 150 HTG.');
      return;
    }
    if (method === 'B2B' && !receiver) {
      setErrorMsg("L'email du destinataire est requis pour le transfert B2B.");
      return;
    }
    if ((method === 'MonCash' || method === 'NatCash') && !receiver) {
      setErrorMsg(`Le numéro de réception est requis pour ${method}.`);
      return;
    }
    if (isUsdMethod && !receiver) {
      setErrorMsg(`L'email ou l'identifiant ${method} est requis.`);
      return;
    }
    if (Number(amount) > activeBalance) {
      setErrorMsg("Votre solde est insuffisant.");
      return;
    }

    try {
      setLoading(true);
      // Skip OTP for test environment
      if (isTest) {
        let res;
        if (method === 'B2B') {
          res = await executeB2BTransfer(Number(amount), receiver, undefined);
        } else {
          res = await requestWithdrawal(Number(amount), method, receiver, undefined, accountCurrency, saveNumber);
        }

        if (res?.error) throw new Error(res.error);

        setIsModalOpen(false);
        setStep('details');
        setAmount('');
        setReceiver('');
        setCode2fa('');
        setSuccessMsg("Simulation de retrait réussie !");
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        // For email OTP, trigger the withdrawal-specific email OTP
        if (twoFactorMethod === 'email' || twoFactorMethod === 'none') {
          const otpRes = await sendWithdrawalOtpAction(Number(amount), method);
          if (otpRes?.error) {
            throw new Error(otpRes.error);
          }
        }
        setStep('otp');
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible d'envoyer le code de vérification.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code2fa && !isTest) {
      setErrorMsg("Veuillez saisir le code de sécurité.");
      return;
    }

    try {
      setLoading(true);
      let res;
      if (method === 'B2B') {
        res = await executeB2BTransfer(Number(amount), receiver, code2fa);
      } else {
        res = await requestWithdrawal(Number(amount), method, receiver, code2fa, accountCurrency, saveNumber);
      }

      if (res?.error) {
        throw new Error(res.error);
      }

      setIsModalOpen(false);
      setStep('details');
      setCode2fa('');

      if (method === 'B2B') {
        // Redirection for B2B transfers
        window.location.href = `/dashboard/success?amount=${amount}&recipient=${encodeURIComponent(receiver)}&type=transfer`;
        return;
      }

      setAmount('');
      setReceiver('');

      const successMessage = (res as any)?.status === 'completed'
        ? "Votre retrait a été effectué avec succès."
        : "Demande de retrait initiée et en cours de traitement.";

      setSuccessMsg(successMessage);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erreur lors de la demande");
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setStep('details');
    setCode2fa('');
    setErrorMsg('');
  };

  const completedWithdrawals = withdrawals.filter(w => w.status === 'completed' || w.status === 'paid');
  const totalWithdrawnHtg = completedWithdrawals.filter(w => (w.currency || 'HTG') === 'HTG').reduce((sum, w) => sum + Number(w.total || w.amount), 0);
  const totalWithdrawnUsd = completedWithdrawals.filter(w => w.currency === 'USD').reduce((sum, w) => sum + Number(w.total || w.amount), 0);
  const filteredWithdrawals = filterStatus === 'all'
    ? withdrawals
    : filterStatus === 'pending'
      ? withdrawals.filter(w => w.status === 'pending' || w.status === 'pending_approval')
      : withdrawals.filter(w => w.status === filterStatus);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'Complété', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500', border: 'border-l-green-500' };
      case 'paid': return { label: 'Complété', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500', border: 'border-l-green-500' };
      case 'pending': return { label: 'En traitement', bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', border: 'border-l-amber-500' };
      case 'pending_approval': return { label: 'En attente', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-l-blue-500' };
      case 'processing': return { label: 'En traitement', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-l-blue-500' };
      case 'rejected': return { label: 'Refusé', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500', border: 'border-l-red-500' };
      case 'failed': return { label: 'Échoué', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500', border: 'border-l-red-500' };
      default: return { label: status, bg: 'bg-white/5', text: 'text-slate-400', dot: 'bg-slate-500', border: 'border-l-white/10' };
    }
  };

  return (
    <div className="max-w-[1080px] w-full mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Retraits & Solde</h1>
          <p className="text-sm text-slate-400 mt-1">Gérez vos retraits et suivez votre solde en temps réel.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/20 transition-colors shadow-sm flex items-center gap-2 border border-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code</span>
            Mon QR Code
          </button>
          <button
            onClick={() => { setAccountCurrency('HTG'); setMethod('MonCash'); setIsModalOpen(true); }}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            Initier un Retrait
          </button>
        </div>
      </div>

      {/* Success Message */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-status-success/10 border border-status-success/20 text-status-success text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-[20px]">check_circle</span>
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Currency balances */}
      <div className={`grid grid-cols-1 gap-4 ${usdAccountActive ? 'md:grid-cols-2' : ''}`}>
        <article className="rounded-lg border border-[#27364B] bg-[#111C2C] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Solde disponible HTG</p>
              <h2 className="mt-3 text-3xl font-bold text-white">
                {activeHtgBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} <span className="text-sm text-slate-500">HTG</span>
              </h2>
              <p className="mt-2 text-xs text-slate-500">MonCash, NatCash et transferts locaux</p>
            </div>
            <span className="material-symbols-outlined rounded-lg bg-orange-500/10 p-2.5 text-orange-400">account_balance_wallet</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => { setAccountCurrency('HTG'); setMethod('MonCash'); setReceiver(savedMoncashNumber); setIsModalOpen(true); }} className="min-h-10 rounded-lg bg-orange-500 px-4 text-sm font-bold text-white transition-colors hover:bg-orange-600">Utiliser ce compte</button>
            <button onClick={() => { setAccountCurrency('HTG'); setMethod('B2B'); setReceiver(''); setIsModalOpen(true); }} className="min-h-10 rounded-lg border border-[#34465F] px-4 text-sm font-bold text-slate-200 transition-colors hover:bg-white/5">Transfert B2B</button>
          </div>
        </article>

        {usdAccountActive && <article className="rounded-lg border border-[#27364B] bg-[#111C2C] p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Solde disponible USD</p>
              <h2 className="mt-3 text-3xl font-bold text-white">
                ${activeUsdBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-slate-500">USD</span>
              </h2>
              <p className="mt-2 text-xs text-slate-500">Carte, PayPal, Apple Pay et Google Pay</p>
            </div>
            <span className="material-symbols-outlined rounded-lg bg-blue-500/10 p-2.5 text-blue-400">payments</span>
          </div>
          <div className="mt-6">
            <button onClick={() => { setAccountCurrency('USD'); setMethod('PayPal'); setReceiver(''); setIsModalOpen(true); }} disabled={activeUsdBalance <= 0} className="min-h-10 rounded-lg bg-blue-500 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40">Utiliser ce compte</button>
          </div>
          <p className="mt-3 text-xs text-slate-500">Traitement manuel après vérification, généralement sous 1 à 3 jours ouvrables.</p>
        </article>}
      </div>

      {/* Secondary Stats */}
      <div className={`grid grid-cols-1 gap-4 ${usdAccountActive ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-5 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-orange-400">hourglass_empty</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Solde en attente (Paiements)</p>
            <h3 className="text-xl font-bold text-white">{Number(merchant.pending_balance || 0).toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">HTG</span></h3>
          </div>
        </div>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-5 shadow-sm flex items-center gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] text-green-400">trending_down</span>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Total Retiré</p>
            <h3 className="text-xl font-bold text-white">{totalWithdrawnHtg.toLocaleString('fr-FR')} <span className="text-sm font-normal text-slate-400">HTG</span></h3>
          </div>
        </div>
        {usdAccountActive && <div className="flex items-center gap-4 rounded-lg border border-white/10 bg-white/5 p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
            <span className="material-symbols-outlined text-[24px] text-blue-400">trending_down</span>
          </div>
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">Total retiré USD</p>
            <h3 className="text-xl font-bold text-white">${totalWithdrawnUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-sm font-normal text-slate-400">USD</span></h3>
          </div>
        </div>}
      </div>

      {/* Withdrawal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131B2C] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-5">
              <h2 className="text-lg font-bold text-white">
                {step === 'details' ? 'Initier un Retrait' : 'Vérification de sécurité'}
              </h2>
              <p className="text-white/50 text-xs mt-1">
                {step === 'details'
                  ? 'Choisissez le compte à débiter, puis votre moyen de réception.'
                  : 'Veuillez confirmer votre identité pour valider ce retrait'}
              </p>
            </div>

            <div className="p-6">
              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {step === 'details' ? (
                <form onSubmit={handleInitialSubmit} className="space-y-4">
                  <fieldset>
                    <legend className="mb-2 block text-xs font-bold text-slate-400">Compte à débiter</legend>
                    <div className={`grid gap-2 rounded-lg bg-white/5 p-1 ${usdAccountActive ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <button
                        type="button"
                        onClick={() => setAccountCurrency('HTG')}
                        className={`min-h-12 rounded-md px-3 text-left transition-colors ${accountCurrency === 'HTG' ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <span className="block text-xs font-bold">Compte HTG</span>
                        <span className="block text-[11px] opacity-75">{formatWithdrawalAmount(activeHtgBalance, 'HTG')}</span>
                      </button>
                      {usdAccountActive && <button
                        type="button"
                        onClick={() => method !== 'B2B' && setAccountCurrency('USD')}
                        disabled={method === 'B2B'}
                        className={`min-h-12 rounded-md px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${accountCurrency === 'USD' ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                      >
                        <span className="block text-xs font-bold">Compte USD</span>
                        <span className="block text-[11px] opacity-75">{formatWithdrawalAmount(activeUsdBalance, 'USD')}</span>
                      </button>}
                    </div>
                  </fieldset>
                  <div>
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">Montant à débiter ({selectedCurrency}) - Max: {formatWithdrawalAmount(activeBalance, selectedCurrency)}</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="1000.00"
                      max={activeBalance}
                      min="0.01"
                      step="0.01"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all"
                      required
                    />
                    {amount && Number(amount) > 0 && method !== 'B2B' && (
                      <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Compte débité</span>
                          <span>{formatWithdrawalAmount(Number(amount), accountCurrency)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-orange-400">
                          <span>Frais de retrait ({feeRate * 100}%)</span>
                          <span>-{formatWithdrawalAmount(Number(amount) * feeRate, accountCurrency)}</span>
                        </div>
                        {accountCurrency !== payoutCurrency && (
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>Taux appliqué</span>
                            <span>1 USD = {exchangeRate.toLocaleString('fr-FR')} HTG</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-white mt-2 pt-2 border-t border-white/10">
                          <span>Montant net à recevoir</span>
                          <span className="text-green-400">{formatWithdrawalAmount(estimatedPayout, payoutCurrency)}</span>
                        </div>
                      </div>
                    )}
                    {amount && Number(amount) > 0 && method === 'B2B' && (
                      <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 space-y-2">
                        <div className="flex justify-between text-sm text-slate-400">
                          <span>Montant envoyé</span>
                          <span>{Number(amount).toLocaleString('fr-FR')} HTG</span>
                        </div>
                        <div className="flex justify-between text-sm text-green-400">
                          <span>Frais B2B appliqués (0%)</span>
                          <span>Gratuit</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">Méthode de réception</label>
                    <select
                      value={method}
                      onChange={(e) => {
                        const nextMethod = e.target.value;
                        setMethod(nextMethod);
                        if (nextMethod === 'B2B') setAccountCurrency('HTG');
                      }}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all [&>option]:bg-[#131B2C]"
                    >
                      <option value="MonCash">MonCash</option>
                      <option value="NatCash">NatCash</option>
                      {usdAccountActive && <option value="Zelle">Zelle (USD, traitement manuel)</option>}
                      {usdAccountActive && <option value="PayPal">PayPal (USD, traitement manuel)</option>}
                      <option value="B2B">Transfert B2B (Gratuit)</option>
                      <option value="Sogebank" disabled>Sogebank (Bientôt)</option>
                      <option value="Unibank" disabled>Unibank (Bientôt)</option>
                    </select>
                  </div>

                  {method === 'B2B' && (
                    <div>
                      <label className="block text-xs text-slate-400 font-bold mb-1.5">Email du marchand destinataire</label>
                      <input
                        type="email"
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        placeholder="marchand@exemple.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all mb-3"
                        required
                      />
                    </div>
                  )}

                  {isUsdMethod && (
                    <div>
                      <label className="block text-xs text-slate-400 font-bold mb-1.5">{method === 'Zelle' ? 'Email ou téléphone Zelle' : 'Adresse e-mail PayPal'}</label>
                      <input
                        type={method === 'PayPal' ? 'email' : 'text'}
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        placeholder="email@exemple.com"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all mb-3"
                        required
                      />
                      <p className="text-xs leading-relaxed text-slate-500">Le montant est réservé sur votre compte {accountCurrency} dès la demande, puis envoyé en USD après validation administrative sous 1 à 3 jours ouvrables.</p>
                    </div>
                  )}

                  {(method === 'MonCash' || method === 'NatCash') && (
                    <div>
                      <label className="block text-xs text-slate-400 font-bold mb-1.5">Numéro de téléphone ({method})</label>
                      <input
                        type="tel"
                        value={receiver}
                        onChange={(e) => setReceiver(e.target.value)}
                        placeholder="3xxxxxxx"
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all mb-3"
                        required
                      />
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveNumber}
                          onChange={(e) => setSaveNumber(e.target.checked)}
                          className="rounded border-white/10 text-orange-500 focus:ring-orange-500/30 bg-white/5 w-4 h-4"
                        />
                        <span className="text-sm text-slate-400">Enregistrer ce numéro pour les prochains retraits</span>
                      </label>
                    </div>
                  )}
                  <div className="flex justify-end gap-3 pt-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-5 py-2.5 text-slate-400 hover:bg-white/5 rounded-xl transition-colors text-sm font-bold"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all text-sm font-bold shadow-sm"
                    >
                      {loading ? 'Traitement...' : 'Continuer'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <div className="pt-2">
                    <label className="block text-xs text-slate-400 font-bold mb-1.5">
                      Code de sécurité ({(twoFactorMethod === 'totp') ? 'App Authenticator' : 'E-mail'})
                    </label>
                    <input
                      type="text"
                      value={code2fa}
                      onChange={(e) => setCode2fa(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all text-center tracking-widest font-mono font-bold text-2xl"
                      required
                    />
                    {(twoFactorMethod === 'email' || twoFactorMethod === 'none') && (
                      <p className="text-xs text-slate-400 mt-3 text-center">
                        Un code à 6 chiffres a été envoyé à <strong>{userEmail}</strong>.<br />Veuillez le saisir ci-dessus pour valider la transaction.
                      </p>
                    )}
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('details')}
                      className="px-5 py-2.5 text-slate-400 hover:bg-white/5 rounded-xl transition-colors text-sm font-bold"
                    >
                      Retour
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-all text-sm font-bold shadow-sm"
                    >
                      {loading ? 'Validation...' : 'Valider le retrait'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal History */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">Historique des Retraits</h3>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 transition-all shadow-sm [&>option]:bg-[#131B2C]"
          >
            <option value="all">Tous les statuts</option>
            <option value="completed">Complétés</option>
            <option value="pending">En attente / En traitement</option>
            <option value="rejected">Refusés</option>
            <option value="failed">Échoués</option>
          </select>
        </div>
        <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-transparent border-b border-white/10">
                <tr>
                  <th className="py-3.5 px-5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Date & Réf</th>
                  <th className="py-3.5 px-5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Méthode</th>
                  <th className="py-3.5 px-5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Montant</th>
                  <th className="py-3.5 px-5 font-bold text-slate-400 uppercase tracking-wider text-[11px]">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredWithdrawals.length > 0 ? filteredWithdrawals.map(w => {
                  const cfg = getStatusConfig(w.status);
                  return (
                    <tr
                      key={w.id}
                      onClick={() => setSelectedWithdrawal(w)}
                      className={`hover:bg-white/5 transition-colors group border-l-4 cursor-pointer ${cfg.border}`}
                    >
                      <td className="py-4 px-5">
                        <div className="font-mono text-xs text-white truncate max-w-[160px] font-bold">{w.kobara_reference}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{new Date(w.created_at).toLocaleDateString('fr-FR')}</div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px] text-slate-400">smartphone</span>
                          <span className="font-bold text-white text-sm">{getWithdrawalMethodDisplay(w.provider || w.method)}</span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="font-bold text-white">-{formatWithdrawalAmount(w.total || w.amount, w.currency)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Reçu : {formatWithdrawalAmount(w.payout_amount || w.amount, w.payout_currency || w.currency)}</div>
                      </td>
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="py-14 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center mb-3">
                        <span className="material-symbols-outlined text-4xl text-slate-500/30">account_balance_wallet</span>
                      </div>
                      <p className="text-sm text-slate-400 font-bold">Aucun retrait effectué</p>
                      <p className="text-xs text-slate-500 mt-1">Commencez par effectuer votre premier retrait</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* QR Code Modal */}
      {isQrModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#131B2C] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Votre QR Code B2B</h2>
            <p className="text-slate-400 text-sm mb-6">
              Faites scanner ce code par un autre marchand dans l'application mobile pour recevoir un transfert instantané.
            </p>
            <div className="bg-white p-4 rounded-xl inline-block mx-auto mb-6">
              <QRCodeSVG
                value={`kobara://transfer?email=${userEmail}`}
                size={200}
                bgColor={"#ffffff"}
                fgColor={"#000000"}
                level={"H"}
                includeMargin={false}
              />
            </div>
            <div className="text-sm text-slate-300 font-medium bg-white/5 p-3 rounded-xl border border-white/10 mb-6 break-all">
              {userEmail}
            </div>
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="w-full bg-white/10 text-white px-4 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Withdrawal Detail Modal */}
      {selectedWithdrawal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-[#131B2C] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] p-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-white">Détails du retrait</h2>
                <p className="text-white/50 text-sm mt-1">{selectedWithdrawal.kobara_reference}</p>
              </div>
              <button onClick={() => setSelectedWithdrawal(null)} className="p-2 -mr-2 -mt-2 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-full">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-sm text-slate-400">Montant brut (déduit)</span>
                <span className="font-bold text-white">{formatWithdrawalAmount(selectedWithdrawal.total || selectedWithdrawal.amount, selectedWithdrawal.currency)}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-sm text-slate-400">Frais appliqués</span>
                <span className="font-bold text-orange-400">-{formatWithdrawalAmount(selectedWithdrawal.fees || 0, selectedWithdrawal.currency)}</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-white/10">
                <span className="text-sm font-bold text-white">Montant net (reçu)</span>
                <span className="text-xl font-bold text-green-400">{formatWithdrawalAmount(selectedWithdrawal.payout_amount || selectedWithdrawal.amount, selectedWithdrawal.payout_currency || selectedWithdrawal.currency)}</span>
              </div>

              {selectedWithdrawal.currency !== (selectedWithdrawal.payout_currency || selectedWithdrawal.currency) && (
                <div className="flex justify-between items-center pb-4 border-b border-white/10">
                  <span className="text-sm text-slate-400">Taux appliqué</span>
                  <span className="font-bold text-white">1 USD = {Number(selectedWithdrawal.exchange_rate || exchangeRate).toLocaleString('fr-FR')} HTG</span>
                </div>
              )}

              <div className="bg-white/5 p-4 rounded-xl border border-white/10 mt-2 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Méthode</span>
                  <span className="text-sm font-bold text-white capitalize flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-orange-500">smartphone</span>
                    {getWithdrawalMethodDisplay(selectedWithdrawal.provider || selectedWithdrawal.method)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Destinataire</span>
                  <span className="text-sm font-bold text-white">{selectedWithdrawal.wallet || 'Non spécifié'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Date</span>
                  <span className="text-sm font-bold text-white">
                    {new Date(selectedWithdrawal.created_at).toLocaleString('fr-FR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-400">Statut</span>
                  {(() => {
                    const cfg = getStatusConfig(selectedWithdrawal.status);
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                        {cfg.label}
                      </span>
                    )
                  })()}
                </div>
                {selectedWithdrawal.status === 'rejected' && selectedWithdrawal.rejection_reason && (
                  <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <p className="text-xs text-red-400 font-bold mb-1">Raison du refus :</p>
                    <p className="text-sm text-red-300">{selectedWithdrawal.rejection_reason}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end">
              <button
                onClick={() => setSelectedWithdrawal(null)}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
