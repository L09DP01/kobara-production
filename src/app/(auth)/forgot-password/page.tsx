"use client"

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, KeyRound, Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { requestPasswordReset } from '../actions'
import { useTranslation } from '@/context/LanguageContext'
import Image from 'next/image'
import { TurnstileWidget } from '@/components/ui/turnstile-widget'

export default function ForgotPasswordPage() {
  const { language } = useTranslation();
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await requestPasswordReset(email, language, turnstileToken);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccess(true);
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
          {language === "fr" ? "Mot de passe oublié ?" : "Reset password"}
        </h1>
        <p className="text-[#AAB3C2] text-sm font-medium leading-relaxed">
          {language === "fr" 
            ? "Saisissez votre adresse e-mail et nous vous enverrons un lien sécurisé pour réinitialiser votre mot de passe." 
            : "Enter your email address and we'll send you a secure link to reset your password."}
        </p>
      </div>

      {success && (
        <div className="mb-6 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-emerald-400 mb-1">
              {language === "fr" ? "E-mail envoyé" : "Email sent"}
            </p>
            <p className="text-[#AAB3C2] leading-relaxed text-[13px]">
              {language === "fr"
                ? "Si un compte existe pour cette adresse, un e-mail avec les instructions de réinitialisation vous a été envoyé."
                : "If an account exists for this address, an email with reset instructions has been sent to you."}
            </p>
          </div>
        </div>
      )}

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
          <label className="block text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2.5 transition-colors group-focus-within:text-[#FF4A1C]" htmlFor="email">
            {language === "fr" ? "Adresse e-mail" : "Email address"}
          </label>
          <div className="relative flex items-center">
            <div className="absolute left-4 flex items-center pointer-events-none text-[#AAB3C2] group-focus-within:text-[#FF4A1C] transition-colors">
              <Mail className="h-5 w-5" />
            </div>
            <input 
              id="email"
              name="email"
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-medium text-white placeholder-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder="you@company.com"
            />
          </div>
        </div>

        <TurnstileWidget
          onVerify={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken('')}
          onError={() => setTurnstileToken('')}
        />

        <button 
          type="submit"
          disabled={loading}
          className="w-full h-14 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center gap-3 mt-8 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95 group/btn"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {language === "fr" ? "Envoi en cours..." : "Sending..."}
            </>
          ) : (
            <>
              {language === "fr" ? "Envoyer le lien de réinitialisation" : "Send reset link"}
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-[#1E2A38]">
        <Link 
          href="/login"
          className="inline-flex items-center gap-2 text-[13px] font-bold text-[#AAB3C2] hover:text-[#FF4A1C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === "fr" ? "Retour à la connexion" : "Back to login"}
        </Link>
      </div>
    </div>
  )
}
