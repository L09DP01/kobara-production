"use client"

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTranslation } from '@/context/LanguageContext'
import { verifyCredentialsAction } from '../actions'
import { TurnstileWidget } from '@/components/ui/turnstile-widget'

function LoginContent() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const errorParam = searchParams.get('error');
  const registered = searchParams.get('registered') === 'true';
  const resetSuccess = searchParams.get('reset') === 'success';
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam === 'session_expired' 
      ? (language === 'fr' ? 'Votre session a expiré après 2 heures d\'inactivité. Veuillez vous reconnecter.' : 'Your session expired after 2 hours of inactivity. Please log in again.')
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
        let dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.kobara.app';
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          dashboardUrl = '/dashboard';
        }
        window.location.href = dashboardUrl;
      }
    } catch (err: any) {
      setError(err?.message || (language === "fr" ? "Une erreur inattendue est survenue." : "An unexpected error occurred."));
      setLoading(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
      
      <div className="mb-10">
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter mb-4">
          {t("auth.loginTitle")}
        </h1>
        <p className="text-[#AAB3C2] font-medium leading-relaxed text-lg">
          {t("auth.loginSubtitle")}
        </p>
      </div>

      {/* Success Notification Banner */}
      {(registered || searchParams.get('success')) && (
        <div className="mb-8 p-5 bg-[#27C93F]/10 border border-[#27C93F]/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(39,201,63,0.1)]">
          <CheckCircle2 className="w-5 h-5 text-[#27C93F] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#27C93F] mb-1">{searchParams.get('success') ? "Vérification réussie" : t("auth.successTitle")}</p>
            <p className="text-[#AAB3C2] leading-relaxed text-[13px]">
              {searchParams.get('success') || t("auth.successDesc")}
            </p>
          </div>
        </div>
      )}

      {/* Reset Password Success Banner */}
      {resetSuccess && (
        <div className="mb-8 p-5 bg-[#27C93F]/10 border border-[#27C93F]/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(39,201,63,0.1)]">
          <CheckCircle2 className="w-5 h-5 text-[#27C93F] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#27C93F] mb-1">
              {language === "fr" ? "Mot de passe réinitialisé" : "Password reset successfully"}
            </p>
            <p className="text-[#AAB3C2] leading-relaxed text-[13px]">
              {language === "fr"
                ? "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter avec votre nouveau mot de passe."
                : "Your password has been successfully reset. You can now log in with your new password."}
            </p>
          </div>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="mb-8 p-5 bg-[#FF5F56]/10 border border-[#FF5F56]/20 rounded-2xl flex items-start gap-4 text-white text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 shadow-[0_0_20px_rgba(255,95,86,0.1)]">
          <XCircle className="w-5 h-5 text-[#FF5F56] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#FF5F56] mb-1">{language === "fr" ? "Erreur d'authentification" : "Authentication error"}</p>
            <p className="text-[#AAB3C2] leading-relaxed text-[13px]">
              {error}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="group relative">
          <label className="block text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider mb-2.5 transition-colors group-focus-within:text-[#FF4A1C]" htmlFor="email">
            {t("auth.emailLabel")}
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
              autoComplete="username webauthn"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                if (typeof window !== 'undefined' && val) {
                  localStorage.setItem('kobara_last_email', val.toLowerCase().trim());
                }
              }}
              className="w-full pl-12 pr-4 py-4 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-medium text-white placeholder-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder="you@company.com"
            />
          </div>
        </div>
        
        <div className="group relative">
          <div className="flex items-center justify-between mb-2.5">
            <label className="block text-[11px] font-bold text-[#AAB3C2] uppercase tracking-wider transition-colors group-focus-within:text-[#FF4A1C]" htmlFor="password">
              {t("auth.passwordLabel")}
            </label>
            <Link href="/forgot-password" className="text-[13px] font-bold text-[#AAB3C2] hover:text-[#FF4A1C] transition-colors">
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <div className="relative flex items-center">
            <div className="absolute left-4 flex items-center pointer-events-none text-[#AAB3C2] group-focus-within:text-[#FF4A1C] transition-colors">
              <Lock className="h-5 w-5" />
            </div>
            <input 
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-[#07111F] border border-[#1E2A38] rounded-2xl font-medium text-white placeholder-[#1E2A38] focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all shadow-inner"
              placeholder="••••••••"
            />
            <button 
              type="button" 
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 flex items-center text-[#AAB3C2] hover:text-white transition-colors p-1"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
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
              {language === "fr" ? "Connexion en cours..." : "Signing in..."}
            </>
          ) : (
            <>
              {t("auth.loginBtn")}
              <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
            </>
          )}
        </button>

        <div className="flex items-center gap-4 my-8">
          <div className="h-[1px] flex-1 bg-[#1E2A38]"></div>
          <span className="text-[11px] font-bold text-[#AAB3C2] uppercase tracking-widest">{language === "fr" ? "Ou continuer avec" : "Or continue with"}</span>
          <div className="h-[1px] flex-1 bg-[#1E2A38]"></div>
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
                let dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://dashboard.kobara.app';
                if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                  dashboardUrl = '/dashboard';
                }
                window.location.href = dashboardUrl;
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
          className="w-full h-14 bg-[#07111F] border border-[#1E2A38] text-white rounded-2xl font-bold text-[14px] hover:border-[#AAB3C2]/50 transition-all flex items-center justify-center gap-3 mb-4 active:scale-95 group/passkey"
        >
          <span className="material-symbols-outlined text-[20px] text-[#AAB3C2] group-hover/passkey:text-[#FF4A1C] transition-colors">fingerprint</span>
          {language === "fr" ? "Se connecter avec Passkey" : "Sign in with Passkey"}
        </button>

        <button 
          type="button"
          className="w-full h-14 bg-[#07111F] border border-[#1E2A38] text-white rounded-2xl font-bold text-[14px] hover:border-[#AAB3C2]/50 transition-all flex items-center justify-center gap-3 active:scale-95"
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

      <div className="mt-10 text-center">
        <p className="text-[14px] font-medium text-[#AAB3C2]">
          {t("auth.dontHaveAccount")}{' '}
          <Link href="/register" className="font-bold text-white hover:text-[#FF4A1C] transition-colors underline underline-offset-4 decoration-[#1E2A38] hover:decoration-[#FF4A1C]">
            {t("auth.signUpNow")}
          </Link>
        </p>
      </div>
    </div>
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
