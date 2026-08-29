'use client';

import { useState } from 'react';
import { createUsdAccountAction } from '@/app/dashboard/usd-account-actions';
import { Plus, CreditCard, AlertTriangle, CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface UsdAccountSectionProps {
  isEligible: boolean;
  hasUsdAccount: boolean;
  availableBalanceUsd: number;
}

export default function UsdAccountSection({
  isEligible,
  hasUsdAccount: initialHasUsd,
  availableBalanceUsd: initialBalanceUsd,
}: UsdAccountSectionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasUsdAccount, setHasUsdAccount] = useState(initialHasUsd);
  const [balanceUsd] = useState(initialBalanceUsd);
  const router = useRouter();

  const handleCreateAccount = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createUsdAccountAction();
      if (res.success) {
        setHasUsdAccount(true);
        setSuccess(true);
        router.refresh();
      } else {
        setError(res.error || "Erreur lors de l'activation du compte USD.");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  // Cas 1 : Pas éligible et pas de compte -> Rien n'apparaît
  if (!isEligible && !hasUsdAccount) {
    return null;
  }

  // Cas 2 : Éligible mais compte USD non encore créé -> Carte d'invitation avec bouton '+'
  if (isEligible && !hasUsdAccount) {
    return (
      <div className="flex min-h-40 flex-col justify-between gap-4 rounded-lg border border-[#27364B] bg-[#111C2C] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:border-[#34465F]">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-bold">Compte USD</span>
            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded">
              Disponible
            </span>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
            <CreditCard className="w-5 h-5" />
          </div>
        </div>

        <div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Acceptez les paiements internationaux par <strong>Carte Bancaire</strong>, <strong>Apple Pay</strong>, <strong>Google Pay</strong> et <strong>PayPal</strong>.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleCreateAccount}
          disabled={loading}
          className="flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-xs font-bold text-white transition-colors duration-150 hover:bg-orange-600 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Ouverture en cours...</span>
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              <span>Créer mon compte USD</span>
            </>
          )}
        </button>
      </div>
    );
  }

  // Cas 3 : Compte USD créé mais PayPal a été suspendu -> Carte Grisée avec alerte
  if (!isEligible && hasUsdAccount) {
    return (
      <div className="flex min-h-40 flex-col justify-between gap-4 rounded-lg border border-red-500/25 bg-[#111C2C] p-5 opacity-80 shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition-opacity duration-150 hover:opacity-100">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400 font-bold">Solde USD ($)</span>
            <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded">
              Suspendu
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-bold text-white">
            •••••• <span className="text-xs font-medium text-slate-500">USD</span>
          </h3>
          <p className="text-xs text-red-400 mt-2">
            Compte USD suspendu par l&apos;administration. Le solde reste protégé.
          </p>
        </div>

        <Link
          href="/dashboard/support"
          className="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1"
        >
          Contacter le support <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // Cas 4 : Compte USD actif et éligible -> Carte de Solde USD complète parfaitement harmonisée
  return (
    <div className="flex min-h-40 flex-col justify-between gap-4 rounded-lg border border-[#27364B] bg-[#111C2C] p-5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] transition-colors duration-150 hover:border-[#34465F]">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400 font-bold">Solde USD ($)</span>
          <span className="bg-blue-500/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded">
            International
          </span>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12 text-blue-400">
          <CreditCard className="w-5 h-5" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold text-white">
          ${balanceUsd.toFixed(2)} <span className="text-xs font-medium text-slate-500">USD</span>
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-slate-500 font-medium">
            Frais : 3.5% + $0.70 • Retrait : 2%
          </span>
        </div>

        {success && (
          <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 p-2 rounded-xl flex items-center gap-1.5 mt-2 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Compte USD activé avec succès !</span>
          </div>
        )}
      </div>

      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
        <Link
          href="/dashboard/withdrawals"
          className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1 transition-colors"
        >
          Retirer en USD <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
