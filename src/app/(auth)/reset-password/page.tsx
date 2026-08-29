"use client"

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Lock, XCircle, Loader2, KeyRound } from 'lucide-react'
import { resetPassword } from '../actions'
import { useTranslation } from '@/context/LanguageContext'
import Image from 'next/image'

function ResetPasswordContent() {
  const { language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? '' : (language === "fr" ? "Lien de réinitialisation manquant ou invalide." : "Missing or invalid reset link."));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError(language === "fr" ? "Lien de réinitialisation invalide." : "Invalid reset link.");
      return;
    }

    if (password !== confirmPassword) {
      setError(language === "fr" ? "Les mots de passe ne correspondent pas." : "Passwords do not match.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await resetPassword(token, password, language);
      if (res?.error) {
        setError(res.error);
      } else {
        router.push('/login?reset=success');
      }
    } catch (err: any) {
      setError(err?.message || (language === "fr" ? "Une erreur inattendue est survenue." : "An unexpected error occurred."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      {/* Mobile Logo */}
      <div className="lg:hidden flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-[#07111F] border border-[#1E2A38] flex items-center justify-center p-2 shadow-[0_0_15px_rgba(255,74,28,0.1)]">
          <Image src="/Icone.png" alt="Kobara Logo" width={24} height={24} className="object-contain" />
        </div>
        <span className="text-white font-black text-xl tracking-tight">Kobara</span>
      </div>

      <div className="mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 flex items-center justify-center text-[#FF4A1C] shadow-[0_0_20px_rgba(255,74,28,0.15)] mb-6">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
          {language === "fr" ? "Nouveau mot de passe" : "Set new password"}
        </h1>
        <p className="text-[#AAB3C2] text-sm font-medium leading-relaxed">
          {language === "fr"
            ? "Choisissez un nouveau mot de passe fort d'au moins 8 caractères."
            : "Choose a new strong password at least 8 characters long."}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-5 bg-[#FF5F56]/10 border border-[#FF5F56]/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(255,95,86,0.1)]">
          <XCircle className="w-5 h-5 text-[#FF5F56] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#FF5F56] mb-1">
              {language === "fr" ? "Erreur" : "Error"}
            </p>
            <p className="text-[#AAB3C2] leading-relaxed text-[13px]">
              {error}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="group relative">
          <label className="block text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2.5 transition-colors group-focus-within:text-[#FF4A1C]" htmlFor="password">
            {language === "fr" ? "Nouveau mot de passe" : "New password"}
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-4 flex items-center pointer-events-none text-[#AAB3C2] group-focus-within:text-[#FF4A1C] transition-colors">
              <Lock className="h-5 w-5" />
            </div>
            <input 
              id="password"
              name="password"
              type="password" 
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-medium text-white placeholder-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder={language === "fr" ? "Min. 8 caractères" : "Min. 8 characters"}
            />
          </div>
        </div>

        <div className="group relative">
          <label className="block text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2.5 transition-colors group-focus-within:text-[#FF4A1C]" htmlFor="confirm_password">
            {language === "fr" ? "Confirmer le mot de passe" : "Confirm new password"}
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-4 flex items-center pointer-events-none text-[#AAB3C2] group-focus-within:text-[#FF4A1C] transition-colors">
              <Lock className="h-5 w-5" />
            </div>
            <input 
              id="confirm_password"
              name="confirm_password"
              type="password" 
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-medium text-white placeholder-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder={language === "fr" ? "Confirmer le mot de passe" : "Confirm password"}
            />
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading || !token}
          className="w-full h-14 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95 group/btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {language === "fr" ? "Mise à jour..." : "Updating..."}
            </>
          ) : (
            <>
              {language === "fr" ? "Mettre à jour le mot de passe" : "Update password"}
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
