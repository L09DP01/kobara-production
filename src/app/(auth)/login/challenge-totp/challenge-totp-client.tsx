'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '../../actions';
import { verifyTotpChallengeAction } from '@/app/dashboard/settings/actions';
import { getDashboardUrl } from '@/lib/utils';
import { markClientSessionActive } from '@/lib/session-inactivity';
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
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 flex items-center justify-center text-[#FF4A1C] shadow-[0_0_20px_rgba(255,74,28,0.15)] mb-6">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
          Double Validation (TOTP)
        </h1>
        <p className="text-[#AAB3C2] text-sm font-medium leading-relaxed">
          Entrez le code temporaire généré par votre application d'authentification.
        </p>
      </div>

      <div className="bg-[#07111F] border border-[#1E2A38] rounded-2xl p-4 flex gap-3 items-start mb-6">
        <Smartphone className="w-5 h-5 text-[#FF4A1C] shrink-0 mt-0.5" />
        <div className="text-xs text-[#AAB3C2] leading-relaxed">
          <span className="font-bold text-white">Protection active : </span>
          Saisissez le code à 6 chiffres pour accéder au compte <strong className="text-white">{userEmail}</strong>.
        </div>
      </div>

      {error && (
        <div className="mb-6 p-5 bg-[#FF5F56]/10 border border-[#FF5F56]/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(255,95,86,0.1)]">
          <XCircle className="w-5 h-5 text-[#FF5F56] shrink-0 mt-0.5" />
          <p className="text-xs text-[#AAB3C2]">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-[#AAB3C2]">Validation réussie. Redirection en cours...</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="otp" className="block text-center text-xs font-bold text-[#AAB3C2] uppercase tracking-wider mb-3">
            Code à 6 chiffres
          </label>
          <div className="flex justify-center">
            <input
              id="otp"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              disabled={loading || success}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-64 px-4 py-3.5 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-mono text-center text-2xl font-bold tracking-[0.4em] text-white focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder="000000"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || success || otp.length !== 6}
          className="w-full h-14 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95 group/btn"
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

      <div className="mt-8 pt-6 border-t border-[#1E2A38]">
        <button
          type="button"
          onClick={handleCancel}
          className="w-full flex items-center justify-center gap-2 text-[13px] font-bold text-[#AAB3C2] hover:text-[#FF4A1C] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Retourner à la connexion
        </button>
      </div>
    </div>
  );
}
