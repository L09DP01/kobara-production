"use client"

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/context/LanguageContext'
import { verifyCredentialsAction } from '../actions'
import { TurnstileWidget } from '@/components/ui/turnstile-widget'
import { getDashboardUrl } from '@/lib/utils'
import { markClientSessionActive } from '@/lib/session-inactivity'
import { AuthBackdrop, AuthCardBrand } from '@/components/auth/AuthBackdrop'

function LoginContent() {
  const { t, language } = useTranslation();
  const searchParams = useSearchParams();
  
  const errorParam = searchParams.get('error');
  const registered = searchParams.get('registered') === 'true';
  const resetSuccess = searchParams.get('reset') === 'success';
  const emailParam = searchParams.get('email') || '';
  const callbackUrlParam = searchParams.get('callbackUrl') || '';
  const callbackUrl = callbackUrlParam.startsWith('/') && !callbackUrlParam.startsWith('//') ? callbackUrlParam : getDashboardUrl('/dashboard');

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === 'session_expired' 
      ? (language === 'fr' ? 'Votre session a expiré après 20 minutes d\'inactivité. Veuillez vous reconnecter.' : 'Your session expired after 20 minutes of inactivity. Please log in again.')
      : (errorParam || '')
  );

  // Auto-fill last used email from localStorage if not provided in URL
  useEffect(() => {
    if (!emailParam && typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('kobara_last_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, [emailParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First verify credentials & Turnstile token via Server Action
      const verifyRes = await verifyCredentialsAction(email, password, language, turnstileToken);
      if (verifyRes?.error) {
        setError(verifyRes.error);
        setLoading(false);
        return;
      }

      // If validation succeeds, log in with NextAuth
      const res = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        language,
        redirect: false
      });

      if (res?.error) {
        let mappedError = res.error;
        if (res.error === 'CredentialsSignin') {
          mappedError = t("auth.loginFailed");
        } else if (res.error === 'Email not confirmed' || res.error.toLowerCase().includes('confirm')) {
          mappedError = t("auth.loginVerificationPending");
        }
        setError(mappedError);
        setLoading(false);
      } else {
        // Success! Redirect to the dashboard
        markClientSessionActive();
        window.location.assign(callbackUrl);
      }
    } catch (err: any) {
      setError(err?.message || (language === "fr" ? "Une erreur inattendue est survenue." : "An unexpected error occurred."));
      setLoading(false);
    }
  };

  return (
    <AuthBackdrop>
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 rounded-lg border border-white/80 bg-white p-5 shadow-[0_28px_80px_rgba(16,19,29,0.22)] duration-700">
      <AuthCardBrand />
      <div className="mb-3">
        <p className="mb-2 text-xs font-bold uppercase text-[#F45D2C]">Espace marchand</p>
        <h1 className="mb-2 text-3xl font-black text-[#10131D] sm:text-4xl">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-sm font-medium leading-relaxed text-[#5C5E66] sm:text-base">
          {t("auth.loginSubtitle")}
        </p>
      </div>

      {/* Success Notification Banner */}
      {(registered || searchParams.get('success')) && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#27A35A]/20 bg-[#EFFAF3] p-4 text-sm font-medium text-[#164B2B] animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-[#27C93F] shrink-0 mt-0.5" />
          <div>
            <p className="mb-1 font-bold text-[#168443]">{searchParams.get('success') ? "Vérification réussie" : t("auth.successTitle")}</p>
            <p className="text-[13px] leading-relaxed text-[#3E684E]">
              {searchParams.get('success') || t("auth.successDesc")}
            </p>
          </div>
        </div>
      )}

      {/* Reset Password Success Banner */}
      {resetSuccess && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#27A35A]/20 bg-[#EFFAF3] p-4 text-sm font-medium text-[#164B2B] animate-in fade-in slide-in-from-top-2 duration-300">
          <CheckCircle2 className="w-5 h-5 text-[#27C93F] shrink-0 mt-0.5" />
          <div>
            <p className="mb-1 font-bold text-[#168443]">
              {language === "fr" ? "Mot de passe réinitialisé" : "Password reset successfully"}
            </p>
            <p className="text-[13px] leading-relaxed text-[#3E684E]">
              {language === "fr"
                ? "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe."
                : "Your password has been successfully reset. You can now log in with your new password."}
            </p>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[#E22F23]/20 bg-[#FFF1EF] p-4 text-sm font-medium text-[#7B211A] animate-in fade-in slide-in-from-top-2 duration-300">
          <XCircle className="w-5 h-5 text-[#FF5F56] shrink-0 mt-0.5" />
          <div>
            <p className="mb-1 font-bold text-[#C52A20]">{language === "fr" ? "Erreur d'authentification" : "Authentication error"}</p>
            <p className="text-[13px] leading-relaxed text-[#8A3B35]">
              {error}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="group relative">
          <label className="mb-2 block text-sm font-bold text-[#333847] transition-colors group-focus-within:text-[#F45D2C]" htmlFor="email">
            {t("auth.emailLabel")}
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-[#9D9EA3] transition-colors group-focus-within:text-[#F45D2C]">
              <Mail className="h-4.5 w-4.5" />
            </div>
            <input 
              id="email"
              name="email"
              type="email" 
              required
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                if (typeof window !== 'undefined' && val) {
                  localStorage.setItem('kobara_last_email', val.toLowerCase().trim());
                }
              }}
              className="min-h-12 w-full rounded-md border border-[#CCD2DA] bg-white py-3 pl-11 pr-4 font-medium text-[#10131D] outline-none transition-all placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10"
              placeholder="you@company.com"
            />
          </div>
        </div>
        
        <div className="group relative">
          <div className="mb-2 flex items-center justify-between gap-4">
            <label className="block text-sm font-bold text-[#333847] transition-colors group-focus-within:text-[#F45D2C]" htmlFor="password">
              {t("auth.passwordLabel")}
            </label>
            <Link href="/forgot-password" className="text-xs font-bold text-[#5C5E66] transition-colors hover:text-[#F45D2C]">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 flex items-center text-[#9D9EA3] transition-colors group-focus-within:text-[#F45D2C]">
              <Lock className="h-4.5 w-4.5" />
            </div>
            <input 
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-12 w-full rounded-md border border-[#CCD2DA] bg-white py-3 pl-11 pr-12 font-medium text-[#10131D] outline-none transition-all placeholder:text-[#9D9EA3] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10"
              placeholder="••••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 flex items-center rounded p-1 text-[#70727A] transition-colors hover:text-[#10131D]"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex min-h-[65px] items-center justify-center overflow-hidden rounded-md bg-[#F7F8FA] px-1">
          <TurnstileWidget
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken('')}
            onError={() => setTurnstileToken('')}
          />
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="group/btn mt-2 flex h-12 w-full items-center justify-center gap-3 rounded-md bg-[#F45D2C] text-[15px] font-bold text-white shadow-[0_10px_24px_rgba(244,93,44,0.24)] transition-all hover:bg-[#E22F23] hover:shadow-[0_12px_28px_rgba(226,47,35,0.28)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {language === "fr" ? "Connexion en cours..." : "Signing in..."}
            </>
          ) : (
            <>
              {t("auth.loginBtn")}
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-[#E1E4E8]"></div>
          <span className="text-xs font-semibold text-[#70727A]">{language === "fr" ? "Ou continuer avec" : "Or continue with"}</span>
          <div className="h-px flex-1 bg-[#E1E4E8]"></div>
        </div>

        <button 
          type="button"
          onClick={async () => {
            let targetEmail = email?.toLowerCase().trim();
            if (!targetEmail && typeof window !== 'undefined') {
              targetEmail = localStorage.getItem('kobara_last_email') || '';
            }
            
            try {
              setLoading(true);
              setError('');
              const { startAuthentication } = await import('@simplewebauthn/browser');
              
              if (typeof window !== 'undefined' && targetEmail) {
                localStorage.setItem('kobara_last_email', targetEmail);
              }

              // 1. Get options (email is optional)
              const resp = await fetch('/api/auth/passkey/generate-authentication-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: targetEmail || '' })
              });
              
              if (!resp.ok) {
                const data = await resp.json();
                throw new Error(data.error || "Erreur lors de la préparation de la connexion Passkey");
              }
              const options = await resp.json();
              
              // 2. Authenticate with browser OS (pops up native passkey list)
              const assertion = await startAuthentication(options);
              
              // 3. Login via NextAuth
              const res = await signIn('passkey', {
                email: targetEmail || '',
                assertionResponse: JSON.stringify(assertion),
                redirect: false
              });

              if (res?.error) {
                setError(res.error);
                setLoading(false);
              } else {
                markClientSessionActive();
                window.location.assign(getDashboardUrl('/dashboard'));
              }
            } catch (err: any) {
              console.error(err);
              if (err.name === 'NotAllowedError') {
                setError(language === "fr" ? "Connexion Passkey annulée." : "Passkey sign-in cancelled.");
              } else {
                setError(err.message || (language === "fr" ? "Erreur biométrique Passkey" : "Biometric Passkey error"));
              }
              setLoading(false);
            }
          }}
          disabled={loading}
          className="group/passkey mb-3 flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#CCD2DA] bg-white text-sm font-bold text-[#10131D] transition-all hover:border-[#9D9EA3] hover:bg-[#F7F8FA] active:translate-y-px"
        >
          <span className="material-symbols-outlined text-[20px] text-[#70727A] transition-colors group-hover/passkey:text-[#F45D2C]">fingerprint</span>
          {language === "fr" ? "Se connecter avec Passkey" : "Sign in with Passkey"}
        </button>

        <button 
          type="button"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-md border border-[#CCD2DA] bg-white text-sm font-bold text-[#10131D] transition-all hover:border-[#9D9EA3] hover:bg-[#F7F8FA] active:translate-y-px"
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
        <p className="text-sm font-medium text-[#5C5E66]">
          {t("auth.dontHaveAccount")}{' '}
          <Link href="/register" className="font-bold text-[#10131D] underline decoration-[#F5B293] underline-offset-4 transition-colors hover:text-[#F45D2C] hover:decoration-[#F45D2C]">
            {t("auth.signUpNow")}
          </Link>
        </p>
      </div>
        </div>
    </AuthBackdrop>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="w-full flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
