'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Smartphone, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';

interface PaymentProcessingLoaderProps {
  paymentId: string;
  amount: number;
  currency?: string;
  phoneNumber?: string;
  method: 'moncash_ussd' | 'natcash_ussd' | 'moncash' | 'natcash';
  merchantName?: string;
  successUrl?: string;
  cancelUrl?: string;
  expiresAt?: string;
}

export function PaymentProcessingLoader({
  paymentId,
  amount,
  currency = 'HTG',
  phoneNumber,
  method,
  merchantName = 'Marchand Kobara',
  successUrl,
  cancelUrl,
  expiresAt,
}: PaymentProcessingLoaderProps) {
  const router = useRouter();
  const [status, setStatus] = useState<'pending' | 'succeeded' | 'failed' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(600); // 10 minutes in seconds
  const [pollCount, setPollCount] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isNatcash = method.toLowerCase().includes('natcash');
  const providerLabel = isNatcash ? 'NatCash' : 'MonCash';
  const providerColor = isNatcash ? 'text-blue-400' : 'text-red-500';
  const providerBg = isNatcash ? 'bg-blue-500/10 border-blue-500/30' : 'bg-red-500/10 border-red-500/30';

  // Format expiration countdown
  useEffect(() => {
    if (expiresAt) {
      const expDate = new Date(expiresAt).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((expDate - now) / 1000));
      setTimeLeft(diffSec);
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  // Polling payment status every 3 seconds
  useEffect(() => {
    if (status !== 'pending') return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}/status`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.status === 'succeeded') {
            setStatus('succeeded');
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => {
              if (successUrl) {
                window.location.href = successUrl;
              } else {
                router.refresh();
              }
            }, 2500);
          } else if (data.status === 'failed') {
            setStatus('failed');
            if (timerRef.current) clearInterval(timerRef.current);
          } else if (data.status === 'expired') {
            setStatus('expired');
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      } catch (err) {
        console.warn("Polling status error:", err);
      } finally {
        if (isMounted) setPollCount((c) => c + 1);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    // Trigger first check immediately
    checkStatus();

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [paymentId, status, successUrl, router]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 text-center text-slate-100 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
      {/* Status: Succeeded */}
      {status === 'succeeded' && (
        <div className="space-y-4 py-4 animate-in zoom-in-90 duration-300">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Paiement Confirmé !</h2>
            <p className="text-xs text-slate-400">
              Votre transaction de <strong className="text-white">{amount} {currency}</strong> a été validée avec succès.
            </p>
          </div>

          <div className="text-xs text-slate-500 flex items-center justify-center gap-2 pt-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Redirection en cours...
          </div>
        </div>
      )}

      {/* Status: Failed */}
      {status === 'failed' && (
        <div className="space-y-4 py-4 animate-in zoom-in-90 duration-300">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <XCircle className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Paiement Échoué</h2>
            <p className="text-xs text-slate-400">
              La transaction n&apos;a pas pu être validée par {providerLabel}. Veuillez réessayer.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs tracking-wider transition-all shadow-lg"
          >
            RÉESSAYER LE PAIEMENT
          </button>
        </div>
      )}

      {/* Status: Expired */}
      {status === 'expired' && (
        <div className="space-y-4 py-4 animate-in zoom-in-90 duration-300">
          <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            <Clock className="w-10 h-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Délai Expiré</h2>
            <p className="text-xs text-slate-400">
              Le temps alloué pour valider votre paiement sur votre mobile a expiré.
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs tracking-wider transition-all border border-slate-700"
          >
            NOUVELLE TENTATIVE
          </button>
        </div>
      )}

      {/* Status: Pending (Live Loader) */}
      {status === 'pending' && (
        <>
          {/* Animated Radar Pulse */}
          <div className="relative w-24 h-24 mx-auto my-2 flex items-center justify-center">
            <div className={`absolute inset-0 rounded-full ${isNatcash ? 'bg-blue-500/20' : 'bg-red-500/20'} animate-ping opacity-75`}></div>
            <div className={`absolute inset-2 rounded-full ${isNatcash ? 'bg-blue-500/30' : 'bg-red-500/30'} animate-pulse`}></div>
            <div className={`relative w-16 h-16 rounded-full bg-slate-950 border-2 ${isNatcash ? 'border-blue-500' : 'border-red-500'} flex items-center justify-center shadow-lg`}>
              <Smartphone className={`w-8 h-8 ${providerColor}`} />
            </div>
          </div>

          {/* Title & Amount */}
          <div className="space-y-1.5">
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border ${providerBg} ${providerColor}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
              Invite USSD {providerLabel} Envoyée
            </div>
            <h2 className="text-2xl font-black text-slate-100 tracking-tight">
              {amount} <span className="text-sm font-semibold text-slate-400">{currency}</span>
            </h2>
            <p className="text-xs text-slate-400">
              À destination de <strong className="text-slate-200">{merchantName}</strong>
            </p>
          </div>

          {/* Instructions Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 text-left space-y-2.5 text-xs text-slate-300">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              Instructions de confirmation :
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 leading-relaxed pl-1">
              <li>Consultez l&apos;invite affichée sur votre téléphone {phoneNumber ? `(${phoneNumber})` : ''}.</li>
              <li>Saisissez votre code PIN secret {providerLabel} pour autoriser le paiement.</li>
              <li>Cette page se mettra à jour <strong>automatiquement</strong> dès validation.</li>
            </ol>
          </div>

          {/* Timer & Polling Indicator */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>Temps restant : <strong className="text-slate-300 font-mono">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</strong></span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Vérification en direct
            </div>
          </div>
        </>
      )}
    </div>
  );
}
