import { signup } from '../actions'
import Link from 'next/link'
import { Mail, Lock, Building2, XCircle } from 'lucide-react'
import { getServerTranslation } from '@/lib/server/i18n'
import { TurnstileFormInput } from '@/components/ui/turnstile-form-input'
import { AuthBackdrop, AuthCardBrand } from '@/components/auth/AuthBackdrop'

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
    <AuthBackdrop>
      <div className="w-full animate-in fade-in slide-in-from-bottom-4 rounded-lg border border-white/80 bg-white p-5 shadow-[0_28px_80px_rgba(16,19,29,0.22)] duration-700">
      <AuthCardBrand />
      <div className="mb-3">
        <p className="mb-2 text-xs font-bold uppercase text-[#F45D2C]">Compte marchand</p>
        <h1 className="mb-2 text-3xl font-black text-[#10131D] sm:text-4xl">
          {t("auth.registerTitle")}
        </h1>
        <p className="text-sm font-medium leading-relaxed text-[#5C5E66] sm:text-base">
          {t("auth.registerSubtitle")}
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#E22F23]/20 bg-[#FFF1EF] p-4 text-sm font-medium text-[#7B211A] animate-in fade-in slide-in-from-top-2 duration-300">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#E22F23]" />
          <div>
            <p className="mb-0.5 font-bold text-[#C52A20]">{language === "fr" ? "Erreur d'inscription" : "Registration error"}</p>
            <p className="text-xs leading-relaxed text-[#8A3B35]">
              {error === "Please use a professional email (consumer domains like Gmail, Yahoo, or Hotmail are not allowed)." || error.includes("professional") 
                ? t("auth.invalidDomainError")
                : error}
            </p>
          </div>
        </div>
      )}

      <form action={signup} className="space-y-3">
        <div className="space-y-3">
        <div className="group">
          <label className="mb-2 block text-sm font-bold text-[#333847] transition-colors group-focus-within:text-[#F45D2C]" htmlFor="business_name">
            {t("auth.businessNameLabel")}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9D9EA3] transition-colors group-focus-within:text-[#F45D2C]">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <input 
              id="business_name"
              name="business_name"
              type="text" 
              required
              maxLength={255}
              autoComplete="organization"
              className="min-h-12 w-full rounded-md border border-[#CCD2DA] bg-white py-3 pl-11 pr-4 font-medium text-[#10131D] outline-none transition-all placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10"
              placeholder={language === "fr" ? "ex: Acme SARL" : "e.g. Acme Corp"}
            />
          </div>
        </div>

        <div className="group">
          <label className="mb-2 block text-sm font-bold text-[#333847] transition-colors group-focus-within:text-[#F45D2C]" htmlFor="email">
            {t("auth.emailLabel")}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9D9EA3] transition-colors group-focus-within:text-[#F45D2C]">
              <Mail className="h-4.5 w-4.5" />
            </div>
            <input 
              id="email"
              name="email"
              type="email" 
              required
              autoComplete="email"
              className="min-h-12 w-full rounded-md border border-[#CCD2DA] bg-white py-3 pl-11 pr-4 font-medium text-[#10131D] outline-none transition-all placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10"
              placeholder="you@company.com"
            />
          </div>
        </div>
        
        <div className="group">
          <label className="mb-2 block text-sm font-bold text-[#333847] transition-colors group-focus-within:text-[#F45D2C]" htmlFor="password">
            {t("auth.passwordLabel")}
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9D9EA3] transition-colors group-focus-within:text-[#F45D2C]">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <input 
              id="password"
              name="password"
              type="password" 
              required
              minLength={8}
              autoComplete="new-password"
              className="min-h-12 w-full rounded-md border border-[#CCD2DA] bg-white py-3 pl-11 pr-4 font-medium text-[#10131D] outline-none transition-all placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10"
              placeholder={language === "fr" ? "Min. 8 caractères" : "Min. 8 characters"}
            />
          </div>
        </div>
        </div>

        <div className="flex min-h-[65px] items-center justify-center overflow-hidden rounded-md bg-[#F7F8FA] px-1">
          <TurnstileFormInput />
        </div>

        <button 
          type="submit"
          className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-4 text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(244,93,44,0.24)] transition-all hover:bg-[#E22F23] hover:shadow-[0_12px_28px_rgba(226,47,35,0.28)] active:translate-y-px"
        >
          {t("auth.registerBtn")}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E1E4E8]"></div>
          <span className="text-xs font-semibold text-[#70727A]">{language === "fr" ? "Ou continuer avec" : "Or continue with"}</span>
          <div className="h-px flex-1 bg-[#E1E4E8]"></div>
        </div>

        <button 
          type="button"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#CCD2DA] bg-white px-4 text-sm font-bold text-[#10131D] transition-all hover:border-[#9D9EA3] hover:bg-[#F7F8FA] active:translate-y-px"
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

      <div className="mt-3 text-center">
        <p className="mb-3 text-xs leading-relaxed text-[#70727A]">
          {t("auth.iAgreeTo")}{' '}
          <Link href="/terms" className="font-bold text-[#333847] underline decoration-[#F5B293] underline-offset-2 transition-colors hover:text-[#F45D2C]">
            {t("nav.terms")}
          </Link>
          {' '}{t("auth.andThe")}{' '}
          <Link href="/privacy" className="font-bold text-[#333847] underline decoration-[#F5B293] underline-offset-2 transition-colors hover:text-[#F45D2C]">
            {t("nav.privacy")}
          </Link>.
        </p>

        <p className="text-sm font-medium text-[#5C5E66]">
          {t("auth.alreadyHaveAccount")}{' '}
          <Link href="/login" className="font-bold text-[#10131D] underline decoration-[#F5B293] underline-offset-4 transition-colors hover:text-[#F45D2C] hover:decoration-[#F45D2C]">
            {t("auth.logInNow")}
          </Link>
        </p>
      </div>
      </div>
    </AuthBackdrop>
  )
}
