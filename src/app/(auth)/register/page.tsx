import { signup } from '../actions'
import Link from 'next/link'
import { Mail, Lock, Building2, Eye, ArrowLeft, XCircle } from 'lucide-react'
import Image from 'next/image'
import { getServerTranslation } from '@/lib/server/i18n'
import { TurnstileFormInput } from '@/components/ui/turnstile-form-input'

export async function generateMetadata() {
  const { t } = await getServerTranslation();
  return {
    title: `${t("auth.registerTitle")} — Kobara`,
    description: t("auth.registerSubtitle"),
  };
}

export default async function RegisterPage(props: { searchParams: Promise<{ error?: string }> }) {
  const params = await props.searchParams;
  const error = params.error;
  const { t, language } = await getServerTranslation();

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 ease-out">
      {/* Back to Home & Mobile Logo */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#020B14] border border-[#1E2A38] flex items-center justify-center shadow-lg">
            <span className="text-[#FF4A1C] font-black text-sm" style={{ transform: "rotateZ(45deg) rotateX(-60deg)" }}>K</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Kobara</span>
        </div>
      </div>

      <div className="mb-10">
        <h1 className="text-4xl font-black text-white tracking-tight mb-3">
          {t("auth.registerTitle")}
        </h1>
        <p className="text-[#AAB3C2] font-medium leading-relaxed">
          {t("auth.registerSubtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-400 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-500 mb-0.5">{language === "fr" ? "Erreur d'inscription" : "Registration error"}</p>
            <p className="text-rose-400/80 leading-relaxed text-xs">
              {error === "Please use a professional email (consumer domains like Gmail, Yahoo, or Hotmail are not allowed)." || error.includes("professional") 
                ? t("auth.invalidDomainError")
                : error}
            </p>
          </div>
        </div>
      )}

      <form action={signup} className="space-y-5">
        <div>
          <label className="block text-[10px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2" htmlFor="business_name">
            {t("auth.businessNameLabel")}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Building2 className="h-5 w-5 text-[#AAB3C2]" />
            </div>
            <input 
              id="business_name"
              name="business_name"
              type="text" 
              required
              maxLength={255}
              className="w-full pl-11 pr-4 py-3.5 bg-[#020B14]/50 border border-[#1E2A38] rounded-xl font-medium text-white placeholder-[#AAB3C2]/50 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder={language === "fr" ? "ex: Acme SARL" : "e.g. Acme Corp"}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2" htmlFor="email">
            {t("auth.emailLabel")}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-[#AAB3C2]" />
            </div>
            <input 
              id="email"
              name="email"
              type="email" 
              required
              className="w-full pl-11 pr-4 py-3.5 bg-[#020B14]/50 border border-[#1E2A38] rounded-xl font-medium text-white placeholder-[#AAB3C2]/50 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder="you@company.com"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-[10px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2" htmlFor="password">
            {t("auth.passwordLabel")}
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-[#AAB3C2]" />
            </div>
            <input 
              id="password"
              name="password"
              type="password" 
              required
              minLength={8}
              className="w-full pl-11 pr-12 py-3.5 bg-[#020B14]/50 border border-[#1E2A38] rounded-xl font-medium text-white placeholder-[#AAB3C2]/50 focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/20 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder={language === "fr" ? "Min. 8 caractères" : "Min. 8 characters"}
            />
            <button type="button" className="absolute inset-y-0 right-0 pr-4 flex items-center">
              <Eye className="h-5 w-5 text-[#AAB3C2] hover:text-white transition-colors" />
            </button>
          </div>
        </div>

        <TurnstileFormInput />

        <button 
          type="submit"
          className="w-full bg-[#FF4A1C] text-white rounded-xl px-4 py-3.5 font-bold text-[15px] hover:bg-[#FF5A2A] transition-all flex items-center justify-center gap-2 mt-6 shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_25px_rgba(255,74,28,0.5)]"
        >
          {t("auth.registerBtn")}
        </button>

        <div className="flex items-center gap-4 my-6">
          <div className="h-[1px] flex-1 bg-[#1E2A38]"></div>
          <span className="text-xs font-medium text-[#AAB3C2] uppercase tracking-wider">{language === "fr" ? "Ou continuer avec" : "Or continue with"}</span>
          <div className="h-[1px] flex-1 bg-[#1E2A38]"></div>
        </div>

        <button 
          type="button"
          className="w-full bg-[#020B14] border border-[#1E2A38] text-white rounded-xl px-4 py-3.5 font-bold text-[14px] hover:bg-[#1E2A38]/50 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          {language === "fr" ? "Continuer avec Google" : "Continue with Google"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <p className="text-xs text-[#AAB3C2] leading-relaxed mb-6">
          {t("auth.iAgreeTo")}{' '}
          <Link href="/terms" className="font-bold text-white hover:text-[#FF4A1C] transition-colors underline decoration-2 underline-offset-2 decoration-[#1E2A38]">
            {t("nav.terms")}
          </Link>
          {' '}{t("auth.andThe")}{' '}
          <Link href="/privacy" className="font-bold text-white hover:text-[#FF4A1C] transition-colors underline decoration-2 underline-offset-2 decoration-[#1E2A38]">
            {t("nav.privacy")}
          </Link>.
        </p>

        <p className="text-sm font-medium text-[#AAB3C2]">
          {t("auth.alreadyHaveAccount")}{' '}
          <Link href="/login" className="font-bold text-[#FF4A1C] hover:text-[#FF5A2A] transition-colors">
            {t("auth.logInNow")}
          </Link>
        </p>
      </div>
    </div>
  )
}
