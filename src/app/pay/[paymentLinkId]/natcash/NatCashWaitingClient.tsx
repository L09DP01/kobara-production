"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { refreshNatCashCode } from './actions';

export function NatCashWaitingClient({ 
  paymentId, 
  amount, 
  referenceCode, 
  merchantName, 
  merchantPhone,
  successUrl,
  expiresAt
}: { 
  paymentId: string, 
  amount: number, 
  referenceCode: string,
  merchantName: string,
  merchantPhone: string,
  successUrl: string,
  expiresAt?: string
}) {
  const [copied, setCopied] = useState(false);
  const [timeLeft, setTimeLeft] = useState(10 * 60);
  const [status, setStatus] = useState<'pending' | 'succeeded' | 'expired' | 'failed'>('pending');
  const [showTranscodeInput, setShowTranscodeInput] = useState(false);
  const [transCode, setTransCode] = useState('');
  const [claimError, setClaimError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [currentReferenceCode, setCurrentReferenceCode] = useState(referenceCode);
  const [currentExpiresAt, setCurrentExpiresAt] = useState<string | undefined>(expiresAt);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleCopy = () => {
    navigator.clipboard.writeText(currentReferenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    // Timer
    const end = currentExpiresAt ? new Date(currentExpiresAt).getTime() : Date.now() + 10 * 60 * 1000;
    
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = Math.floor((end - now) / 1000);
      if (diff <= 0) {
        setTimeLeft(0);
        setStatus('expired');
        clearInterval(timer);
      } else {
        setTimeLeft(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentExpiresAt]);

  useEffect(() => {
    if (status !== 'pending') return;

    // Polling
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'succeeded' || data.status === 'paid') {
            setStatus('succeeded');
            clearInterval(poll);
            setTimeout(() => {
              router.push(successUrl);
            }, 1500);
          } else if (data.status === 'expired' || data.status === 'failed') {
            setStatus(data.status);
            clearInterval(poll);
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [paymentId, status, router, successUrl]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleRefreshCode = async () => {
    try {
      setRefreshing(true);
      const res = await refreshNatCashCode(paymentId);
      if (res.success) {
        setCurrentReferenceCode(res.referenceCode);
        setCurrentExpiresAt(res.expiresAt);
        setTimeLeft(10 * 60);
        setStatus('pending');
      }
    } catch (e) {
      console.error(e);
      alert("Erreur lors de la génération du nouveau code. Veuillez réessayer.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleClaimPayment = async () => {
    if (!transCode.trim()) return;
    setClaiming(true);
    setClaimError('');
    try {
      const res = await fetch(`/api/payments/${paymentId}/claim-transcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transCode: transCode.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('succeeded');
        setTimeout(() => {
          router.push(successUrl);
        }, 1500);
      } else {
        setClaimError(data.error || "Paiement introuvable.");
      }
    } catch (e) {
      setClaimError("Erreur de connexion au serveur.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg ambient-shadow">
      <div className="bg-orange-500 p-6 text-center">
        <h2 className="text-white font-medium opacity-90 uppercase tracking-wider text-xs mb-2">Paiement NatCash</h2>
        <h1 className="text-3xl font-bold text-white">{Number(amount).toLocaleString('fr-FR')} HTG</h1>
      </div>
      
      <div className="p-6 space-y-6">
        {status === 'pending' && (
          <>
            <p className="text-slate-300 text-sm text-center">
              Pour valider ce paiement, veuillez utiliser votre téléphone pour transférer le montant exact au numéro ci-dessous et n'oubliez pas d'insérer le <strong className="text-white">Contenu</strong>.
            </p>

            <div className="bg-black/20 rounded-xl p-4 border border-white/5 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Marchand :</span>
                <span className="text-white font-medium">{merchantName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Numéro NatCash :</span>
                <span className="text-white font-bold text-lg">{merchantPhone}</span>
              </div>
              <div className="pt-4 border-t border-white/10">
                <span className="text-slate-400 text-sm block mb-2">Contenu (Code de référence) :</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#0F1626] border border-orange-500/30 rounded-lg p-3 text-center">
                    <span className="text-orange-400 font-mono font-bold text-xl tracking-widest">{currentReferenceCode}</span>
                  </div>
                  <button 
                    onClick={handleCopy}
                    className="h-[52px] px-4 bg-white/10 hover:bg-white/20 transition-colors rounded-lg flex items-center justify-center"
                    title="Copier le code"
                  >
                    {copied ? <CheckCircle2 size={20} className="text-green-400" /> : <Copy size={20} className="text-white" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-4">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
              <p className="text-white font-medium">En attente du paiement...</p>
              <p className="text-slate-400 text-xs mt-1">Vérification automatique en cours. Ne fermez pas cette page.</p>
              
              <div className="mt-6 flex items-center gap-2 bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/20">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
                <span className="text-orange-400 font-mono text-sm">Expire dans {formatTime(timeLeft)}</span>
              </div>
            </div>
          </>
        )}

        {status === 'succeeded' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Paiement Validé !</h3>
            <p className="text-slate-400 text-sm">Le transfert NatCash a été reçu. Redirection en cours...</p>
          </div>
        )}

        {status === 'expired' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Code Expiré</h3>
            <p className="text-slate-400 text-sm">Le temps imparti (10 min) est écoulé. Si vous avez déjà payé, utilisez votre TransCode ci-dessous.</p>
            
            {showTranscodeInput ? (
              <div className="mt-6 space-y-3 bg-white/5 p-4 rounded-xl border border-white/10 text-left">
                <label className="text-slate-300 text-xs font-medium uppercase tracking-wider block">Numéro de Transaction (TransCode)</label>
                <input 
                  type="text" 
                  value={transCode}
                  onChange={(e) => setTransCode(e.target.value)}
                  placeholder="Ex: 26062687621075"
                  className="w-full bg-[#0F1626] border border-white/20 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500"
                />
                {claimError && <p className="text-red-400 text-xs">{claimError}</p>}
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => setShowTranscodeInput(false)}
                    className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors text-sm"
                  >
                    Annuler
                  </button>
                  <button 
                    onClick={handleClaimPayment}
                    disabled={claiming}
                    className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-medium transition-colors text-sm disabled:opacity-50 flex items-center justify-center"
                  >
                    {claiming ? <Loader2 size={16} className="animate-spin" /> : "Vérifier"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-6">
                <button 
                  onClick={handleRefreshCode}
                  disabled={refreshing}
                  className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {refreshing && <Loader2 size={16} className="animate-spin" />}
                  Générer un nouveau code
                </button>
                <button 
                  onClick={() => setShowTranscodeInput(true)}
                  className="px-6 py-3 bg-orange-500/10 border border-orange-500/30 hover:bg-orange-500/20 rounded-lg text-orange-400 font-medium transition-colors"
                >
                  Déjà payé avec l'ancien code ?
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
