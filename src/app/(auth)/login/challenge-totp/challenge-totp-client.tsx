'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '../../actions';
import { verifyTotpChallengeAction } from '@/app/dashboard/settings/actions';
import { getDashboardUrl } from '@/lib/utils';
import { markClientSessionActive } from '@/lib/session-inactivity';
import { AuthBackdrop, AuthCardBrand } from '@/components/auth/AuthBackdrop';
import {
  Shield,
  Smartphone,
  Loader2,
  CheckCircle2,
  XCircle,
  LogOut
} from 'lucide-react';

export function ChallengeTotpClient({ userEmail }: { userEmail: string }) {
  const router = useRouter();

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;

    setError('');
    setLoading(true);

    try {
      const res = await verifyTotpChallengeAction(otp);
      if (res.success) {
        setSuccess(true);
        markClientSessionActive();
        window.location.assign(getDashboardUrl('/dashboard'));
      }
    } catch (err: any) {
      setError(err.message || 'Le code de vérification est invalide. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    try {
      await logout();
    } catch (err) {
      router.replace('/login');
    }
  };

  return (
    <AuthBackdrop>
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 rounded-lg border border-white/80 bg-white p-5 shadow-[0_28px_80px_rgba(16,19,29,0.22)] duration-700 sm:p-7">
      <AuthCardBrand />
      <div className="mb-5 mt-5">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-[#F45D2C]/20 bg-[#F45D2C]/10 text-[#F45D2C]">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-[#10131D] sm:text-3xl">
          Double vérification
        </h1>
        <p className="text-sm leading-relaxed text-[#5C5E66]">
          Entrez le code temporaire généré par votre application d'authentification.
        </p>
      </div>

      <div className="mb-5 flex items-start gap-3 rounded-md border border-[#E5E7EB] bg-[#F8FAFC] p-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-[#F45D2C]" />
        <div className="min-w-0 text-sm leading-relaxed text-[#5C5E66]">
          Saisissez le code à 6 chiffres pour accéder au compte <strong className="break-words font-semibold text-[#10131D]">{userEmail}</strong>.
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <XCircle className="w-5 h-5 text-[#FF5F56] shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div role="status" className="mb-4 flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p>Validation réussie. Redirection en cours...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="otp" className="mb-2 block text-sm font-semibold text-[#10131D]">
            Code à 6 chiffres
          </label>
          <div className="flex justify-center">
            <input
              id="otp"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              disabled={loading || success}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              className="h-12 w-full rounded-md border border-[#D5D8DE] bg-white px-4 font-mono text-center text-2xl font-semibold text-[#10131D] placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:outline-none focus:ring-2 focus:ring-[#F45D2C]/20 disabled:bg-[#F8FAFC]"
              placeholder="000000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success || otp.length !== 6}
          className="kobara-cta flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#F45D2C] text-sm font-bold text-white transition-colors hover:bg-[#E22F23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F45D2C] disabled:cursor-not-allowed disabled:bg-[#A83B1B]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
              Vérification...
            </span>
          ) : (
            "Valider et se connecter"
          )}
        </button>
      </form>

      <div className="mt-5 border-t border-[#E5E7EB] pt-4">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading || success}
          className="flex min-h-10 w-full items-center justify-center gap-2 text-sm font-semibold text-[#5C5E66] transition-colors hover:text-[#F45D2C] disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4" />
          Retourner à la connexion
        </button>
      </div>
    </div>
    </AuthBackdrop>
  );
}
