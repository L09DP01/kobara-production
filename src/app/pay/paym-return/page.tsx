'use client';

import { Clock3, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function PaymReturnContent() {
  const searchParams = useSearchParams();
  const paymentId = searchParams.get('payment_id');
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [message, setMessage] = useState('Nous attendons la confirmation sécurisée du fournisseur de paiement.');

  useEffect(() => {
    if (!paymentId) {
      window.location.replace('/pay/error?reason=missing_payment');
      return;
    }

    let stopped = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let countdownTimer: ReturnType<typeof setInterval> | undefined;
    let deadline = Date.now() + 10 * 60 * 1000;

    const redirect = (url: string) => {
      stopped = true;
      window.location.replace(url);
    };

    const poll = async () => {
      try {
        const response = await fetch(`/api/payments/${encodeURIComponent(paymentId)}/status`, { cache: 'no-store' });
        const result = await response.json();
        if (stopped) return;

        if (result.deadline) deadline = new Date(result.deadline).getTime();
        if (result.status === 'succeeded' && result.redirectUrl) {
          setMessage('Paiement confirmé. Redirection en cours...');
          redirect(result.redirectUrl);
          return;
        }
        if (['failed', 'expired', 'canceled'].includes(result.status)) {
          redirect(result.redirectUrl || `/pay/error?reason=${result.status}`);
          return;
        }
        if (!response.ok) setMessage('Vérification temporairement indisponible. Nouvelle tentative...');
      } catch {
        setMessage('Connexion temporairement interrompue. Nouvelle tentative...');
      }

      if (Date.now() >= deadline) {
        redirect('/pay/error?reason=expired');
        return;
      }
      pollTimer = setTimeout(poll, 3000);
    };

    countdownTimer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0 && !stopped) redirect('/pay/error?reason=expired');
    }, 1000);
    poll();

    return () => {
      stopped = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [paymentId]);

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0');
  const seconds = (secondsLeft % 60).toString().padStart(2, '0');

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#070b12] p-6 text-white">
      <section className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10">
          <LoaderCircle className="h-8 w-8 animate-spin text-orange-500" />
        </div>
        <h1 className="mt-6 text-2xl font-bold">Vérification du paiement</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">{message}</p>

        <div className="mt-8 border-y border-white/10 py-5">
          <div className="flex items-center justify-center gap-2 text-slate-300">
            <Clock3 className="h-4 w-4 text-orange-500" />
            <span className="font-mono text-xl font-bold tabular-nums">{minutes}:{seconds}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Vérification automatique toutes les 3 secondes</p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4" />
          Ne fermez pas cette page pendant la validation.
        </div>
      </section>
    </main>
  );
}

export default function PaymReturnPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-[#070b12]" />}>
      <PaymReturnContent />
    </Suspense>
  );
}
