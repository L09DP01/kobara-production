'use client'

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  updatePassword, 
  sendEmailOtpAction, 
  verifyEmailOtpAction, 
  generateTotpSecretAction, 
  verifyAndActivateTotpAction, 
  disable2faAction,
  deletePasskeyAction
} from '../actions';
import { getActiveSessions, revokeSession, revokeOtherSessions } from '../sessions-actions';
import { parseUserAgent } from '@/lib/utils/parse-user-agent';
import { 
  Shield, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Smartphone, 
  Laptop,
  Tablet,
  LogOut,
  RefreshCw,
  Copy, 
  Check,
  QrCode,
  Mail,
  ShieldAlert,
  ArrowRight,
  Fingerprint
} from 'lucide-react';

export function SecuritySettings({ user, settings }: { user: any; settings: any }) {

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // DB Saved 2FA Method
  const [dbMethod, setDbMethod] = useState<'none' | 'email' | 'totp'>(
    settings?.security_json?.two_factor_method || 'none'
  );

  // MFA / 2FA local states
  const [selectedMethod, setSelectedMethod] = useState<'none' | 'email' | 'totp'>(
    settings?.security_json?.two_factor_method || 'none'
  );
  
  const [mfaLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');

  // TOTP Configuration state
  const [isConfiguringTotp, setIsConfiguringTotp] = useState(false);
  const [qrCodeSvg, setQrCodeSvg] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Email Configuration state
  const [isConfiguringEmail, setIsConfiguringEmail] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sessions management state
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentToken, setCurrentToken] = useState<string>('');
  const [sessionsLoading, setSessionsLoading] = useState(true);

  // Sync state if settings prop changes
  useEffect(() => {
    // Fetch active sessions
    getActiveSessions().then(res => {
      if (res && res.sessions) {
        setSessions(res.sessions);
        setCurrentToken(res.currentToken || '');
      } else if (Array.isArray(res)) {
        setSessions(res);
      }
      setSessionsLoading(false);
    });

    if (settings?.security_json?.two_factor_method) {
      setDbMethod(settings.security_json.two_factor_method);
      setSelectedMethod(settings.security_json.two_factor_method);
    }
  }, []);

  useEffect(() => {
    if (!settings?.security_json?.two_factor_method) return;
    setDbMethod(settings.security_json.two_factor_method);
    setSelectedMethod(settings.security_json.two_factor_method);
  }, [settings?.security_json?.two_factor_method]);

  // Handle password update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.');
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await updatePassword(newPassword);
      if (res.success) {
        setPasswordSuccess('Votre mot de passe a été mis à jour avec succès !');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Une erreur est survenue lors de la mise à jour.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Cooldown timer for Email OTP
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown(resendCooldown - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Email OTP Flow
  const startEmailConfiguration = async () => {
    setMfaError('');
    setMfaSuccess('');
    setActionLoading(true);
    try {
      await sendEmailOtpAction();
      setEmailOtpSent(true);
      setIsConfiguringEmail(true);
      setResendCooldown(60);
      setMfaSuccess('Un code de vérification a été envoyé à votre adresse e-mail.');
    } catch (err: any) {
      setMfaError(err.message || "Erreur lors de l'envoi du code.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (emailOtp.length !== 6) {
      setMfaError('Veuillez saisir un code à 6 chiffres.');
      return;
    }
    setMfaError('');
    setMfaSuccess('');
    setActionLoading(true);
    try {
      const res = await verifyEmailOtpAction(emailOtp);
      if (res.success) {
        setMfaSuccess('Double authentification par e-mail activée avec succès !');
        setIsConfiguringEmail(false);
        setEmailOtp('');
        setDbMethod('email');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Code de vérification invalide.');
    } finally {
      setActionLoading(false);
    }
  };

  // TOTP Flow
  const startTotpEnrollment = async () => {
    setMfaError('');
    setMfaSuccess('');
    setActionLoading(true);
    try {
      const { secret, qrCodeDataUrl } = await generateTotpSecretAction();
      setSecretKey(secret);
      setQrCodeSvg(qrCodeDataUrl);
      setIsConfiguringTotp(true);
    } catch (err: any) {
      setMfaError(err.message || "Impossible d'initialiser l'application d'authentification.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyTotp = async () => {
    if (totpCode.length !== 6) {
      setMfaError('Veuillez saisir un code à 6 chiffres.');
      return;
    }
    setMfaError('');
    setMfaSuccess('');
    setActionLoading(true);
    try {
      const res = await verifyAndActivateTotpAction(totpCode);
      if (res.success) {
        setMfaSuccess("Authentification par application activée avec succès !");
        setIsConfiguringTotp(false);
        setTotpCode('');
        setDbMethod('totp');
      }
    } catch (err: any) {
      setMfaError(err.message || 'Code de vérification invalide.');
    } finally {
      setActionLoading(false);
    }
  };

  // Disable / Switch 2FA to None
  const handleDisable2fa = async () => {
    if (dbMethod === 'none') return;
    
    if (!confirm('Êtes-vous sûr de vouloir désactiver la double authentification ? Cela réduira considérablement la sécurité de votre compte.')) {
      setSelectedMethod(dbMethod);
      return;
    }

    setMfaError('');
    setMfaSuccess('');
    setActionLoading(true);
    try {
      await disable2faAction();
      setMfaSuccess('Double authentification désactivée.');
      setDbMethod('none');
      setSelectedMethod('none');
    } catch (err: any) {
      setMfaError(err.message || 'Impossible de désactiver le 2FA.');
      setSelectedMethod(dbMethod);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(secretKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Password Management Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-headline-md font-headline-md text-white">Mot de passe</h2>
            <p className="text-body-sm text-slate-400 mt-0.5">Gérez votre mot de passe pour sécuriser votre compte.</p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400 text-sm font-medium animate-in fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <p>{passwordSuccess}</p>
          </div>
        )}

        {passwordError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm font-medium animate-in fade-in duration-300">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p>{passwordError}</p>
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2" htmlFor="new_password">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input 
                id="new_password"
                type={showNewPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm text-sm"
                placeholder="Au moins 6 caractères"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2" htmlFor="confirm_password">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input 
                id="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-medium text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm text-sm"
                placeholder="Répétez le mot de passe"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={passwordLoading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-body-sm font-semibold text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {passwordLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-500" />}
            Mettre à jour le mot de passe
          </button>
        </form>
      </div>

      {/* 2FA Method Selector Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-red-500/20 rounded-xl text-red-400">
            <Shield className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-headline-md font-headline-md text-white">Authentification à deux facteurs (2FA)</h2>
              {!mfaLoading && (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  dbMethod !== 'none' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/20' 
                    : 'bg-orange-500/20 text-orange-400 border border-orange-500/20'
                }`}>
                  {dbMethod !== 'none' ? `Activé (${dbMethod === 'email' ? 'E-mail' : 'App'})` : 'Inactif'}
                </span>
              )}
            </div>
            <p className="text-body-sm text-slate-400 mt-0.5">Choisissez votre méthode de double validation préférée pour sécuriser vos accès et transferts.</p>
          </div>
        </div>

        {mfaSuccess && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400 text-sm font-medium animate-in fade-in duration-300">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <p>{mfaSuccess}</p>
          </div>
        )}

        {mfaError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm font-medium animate-in fade-in duration-300">
            <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p>{mfaError}</p>
          </div>
        )}

        {mfaLoading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            Chargement de la configuration de sécurité...
          </div>
        ) : (
          <div className="space-y-6">
            {/* Interactive Grid Selection */}
            {!isConfiguringTotp && !isConfiguringEmail && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                {/* Option 1: None */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMethod('none');
                    handleDisable2fa();
                  }}
                  className={`flex flex-col text-left p-5 rounded-xl border transition-all relative ${
                    selectedMethod === 'none'
                      ? 'border-orange-500 bg-orange-500/10 shadow-sm'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className={`p-2 rounded-lg ${selectedMethod === 'none' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-400'}`}>
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    {dbMethod === 'none' && (
                      <span className="text-[10px] bg-white/10 text-slate-300 px-2 py-0.5 rounded font-bold uppercase">Actif</span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm">Aucune protection</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Accédez à votre compte uniquement avec votre adresse email et votre mot de passe classique.
                  </p>
                </button>

                {/* Option 2: Email OTP */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    if (dbMethod === 'email') return;
                    setSelectedMethod('email');
                    startEmailConfiguration();
                  }}
                  className={`flex flex-col text-left p-5 rounded-xl border transition-all relative ${
                    selectedMethod === 'email'
                      ? 'border-orange-500 bg-orange-500/10 shadow-sm'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className={`p-2 rounded-lg ${selectedMethod === 'email' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-400'}`}>
                      <Mail className="w-5 h-5" />
                    </div>
                    {dbMethod === 'email' ? (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase">Actif</span>
                    ) : (
                      <span className="text-[9px] border border-white/10 text-slate-400 px-1.5 py-0.5 rounded font-medium">Recommandé</span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm">Code OTP par Email</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Un code temporaire à 6 chiffres est envoyé à votre adresse de messagerie lors de chaque connexion.
                  </p>
                </button>

                {/* Option 3: Authenticator App */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => {
                    if (dbMethod === 'totp') return;
                    setSelectedMethod('totp');
                    startTotpEnrollment();
                  }}
                  className={`flex flex-col text-left p-5 rounded-xl border transition-all relative ${
                    selectedMethod === 'totp'
                      ? 'border-orange-500 bg-orange-500/10 shadow-sm'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className={`p-2 rounded-lg ${selectedMethod === 'totp' ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-slate-400'}`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    {dbMethod === 'totp' ? (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-bold uppercase">Actif</span>
                    ) : (
                      <span className="text-[9px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase">Ultra Securisé</span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm">Application TOTP</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Utilisez Google Authenticator ou une application compatible pour générer des clés temporaires instantanées.
                  </p>
                </button>

              </div>
            )}

            {/* Email Verification Wizard */}
            {isConfiguringEmail && (
              <div className="border border-white/10 rounded-xl p-6 bg-white/5 space-y-6 max-w-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <Mail className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-white text-sm">Validation de votre adresse E-mail</h3>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pour activer la double validation par email, nous venons d'envoyer un code temporaire à 6 chiffres à l'adresse <strong>{user.email}</strong>. Saisissez ce code ci-dessous :
                  </p>

                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-white uppercase tracking-wider" htmlFor="email_otp">
                      Code de validation
                    </label>
                    <div className="flex gap-3">
                      <input 
                        id="email_otp"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={emailOtp}
                        onChange={(e) => setEmailOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-44 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-mono text-center text-lg font-bold tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                        placeholder="000000"
                      />
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleVerifyEmailOtp}
                        className="flex-1 flex items-center justify-center gap-2 px-6 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Activer la protection
                      </button>
                    </div>
                  </div>

                  <div className="text-xs flex items-center justify-between pt-2">
                    <button
                      type="button"
                      disabled={actionLoading || resendCooldown > 0}
                      onClick={startEmailConfiguration}
                      className="text-orange-500 font-medium hover:underline disabled:text-slate-400 disabled:no-underline"
                    >
                      {resendCooldown > 0 ? `Renvoyer le code dans ${resendCooldown}s` : "Renvoyer le code"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsConfiguringEmail(false);
                      setSelectedMethod(dbMethod);
                      setMfaError('');
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* TOTP Verification Wizard */}
            {isConfiguringTotp && (
              <div className="border border-white/10 rounded-xl p-6 bg-white/5 space-y-6 max-w-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                  <QrCode className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-white text-sm">Configurer votre application d'authentification</h3>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    1. Scannez ce code QR avec votre application d'authentification (Google Authenticator, Microsoft Authenticator, Authy, etc.) :
                  </p>
                  
                  <div className="flex justify-center bg-white/5 p-4 rounded-xl border border-white/10 w-fit mx-auto shadow-sm">
                    <img 
                      src={qrCodeSvg} 
                      alt="QR Code MFA" 
                      className="w-44 h-44 rounded bg-white" 
                    />
                  </div>

                  <div className="text-xs text-slate-400 leading-relaxed space-y-2">
                    <p>2. Si vous ne pouvez pas scanner le code QR, saisissez manuellement cette clé secrète dans votre application :</p>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg p-2.5 font-mono text-white text-sm font-semibold w-full justify-between">
                      <span className="break-all tracking-wider">{secretKey}</span>
                      <button 
                        type="button" 
                        onClick={copyToClipboard}
                        className="p-1.5 hover:bg-white/10 rounded-md transition-colors text-slate-400"
                        title="Copier la clé secrète"
                      >
                        {copiedKey ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <label className="block text-xs font-bold text-white" htmlFor="totp_verification_code">
                      3. Entrez le code de vérification à 6 chiffres généré par votre application :
                    </label>
                    <div className="flex gap-3">
                      <input 
                        id="totp_verification_code"
                        type="text"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-44 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-mono text-center text-lg font-bold tracking-widest text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                        placeholder="000000"
                      />
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleVerifyTotp}
                        className="flex-1 flex items-center justify-center gap-2 px-6 bg-orange-500 text-white hover:bg-orange-600 rounded-xl font-semibold text-sm transition-colors shadow-sm disabled:opacity-50"
                      >
                        {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Activer l'A2F App
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-white/10">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsConfiguringTotp(false);
                      setSelectedMethod(dbMethod);
                      setMfaError('');
                    }}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Passkey Management Card */}
      <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm">
        <div className="flex items-start gap-4 mb-6">
          <div className="p-3 bg-green-500/20 rounded-xl text-green-400">
            <span className="material-symbols-outlined">fingerprint</span>
          </div>
          <div>
            <h2 className="text-headline-md font-headline-md text-white">Passkey</h2>
            <p className="text-body-sm text-slate-400 mt-0.5">
              Utilisez la securite de votre appareil pour vous connecter sans mot de passe: Face ID, empreinte digitale, Windows Hello, Android, ou code de deverrouillage selon l'appareil.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <button
            type="button"
            disabled={actionLoading}
            onClick={async () => {
              setActionLoading(true);
              setMfaError('');
              setMfaSuccess('');
              try {
                if (!window.isSecureContext || !navigator.credentials) {
                  throw new Error("Passkey necessite une PWA installee ou une page HTTPS compatible.");
                }

                const { startRegistration } = await import('@simplewebauthn/browser');
                const resp = await fetch('/api/auth/passkey/generate-registration-options');
                if (!resp.ok) throw new Error("Erreur de génération des options");
                const options = await resp.json();
                
                const attResp = await startRegistration(options);
                
                const verifyResp = await fetch('/api/auth/passkey/verify-registration', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(attResp),
                });
                
                if (!verifyResp.ok) throw new Error("Échec de la validation du Passkey");
                setMfaSuccess("Passkey ajouté avec succès ! Rechargez la page pour le voir.");
              } catch (e: any) {
                console.error(e);
                setMfaError(e.message || "Impossible d'ajouter le Passkey.");
              } finally {
                setActionLoading(false);
              }
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-black rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span className="material-symbols-outlined text-[18px]">add</span>
            Ajouter un Passkey
          </button>

          {(settings?.security_json?.passkeys?.length || 0) > 0 && (
            <div className="mt-6 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-transparent border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Passkey</th>
                    <th className="py-3 px-4 font-semibold">Date d'ajout</th>
                    <th className="py-3 px-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 bg-transparent">
                  {settings.security_json.passkeys.map((pk: any) => (
                    <tr key={pk.id}>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500">devices</span>
                        <span className="font-medium text-white capitalize">{pk.deviceType || 'Appareil inconnu'}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(pk.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={async () => {
                            if (!confirm("Voulez-vous vraiment supprimer ce Passkey ?")) return;
                            setActionLoading(true);
                            try {
                              await deletePasskeyAction(pk.id);
                              setMfaSuccess("Passkey supprimé.");
                            } catch (e: any) {
                              setMfaError("Erreur lors de la suppression.");
                            } finally {
                              setActionLoading(false);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 font-medium text-sm transition-colors disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Sessions Management Card */}
      <div className="bg-[#07111F] border border-[#1E2A38] rounded-3xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1E2A38]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Sessions & Appareils</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Appareils et navigateurs actuellement autorisés à accéder à votre compte.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessions.filter((s: any) => !s.isCurrent && (s.session_status || 'active') === 'active').length > 0 && (
              <button
                type="button"
                disabled={actionLoading}
                onClick={async () => {
                  if (!confirm("Voulez-vous vraiment déconnecter TOUS les autres appareils ?")) return;
                  setActionLoading(true);
                  try {
                    const res = await revokeOtherSessions(currentToken);
                    if (res.error) throw new Error(res.error);
                    setSessions(sessions.map((s: any) => s.isCurrent ? s : {
                      ...s,
                      session_status: 'revoked',
                      status: 'revoked',
                      revoked_at: new Date().toISOString(),
                    }));
                    toast.success("Toutes les autres sessions ont été fermées.");
                  } catch (e: any) {
                    toast.error(e.message || "Erreur lors de la déconnexion.");
                  } finally {
                    setActionLoading(false);
                  }
                }}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" />
                Fermer les autres sessions
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSessionsLoading(true);
                getActiveSessions().then(res => {
                  if (res && res.sessions) {
                    setSessions(res.sessions);
                    setCurrentToken(res.currentToken || '');
                  }
                  setSessionsLoading(false);
                });
              }}
              className="p-2.5 rounded-xl bg-[#0F1626] hover:bg-[#1E2A38] border border-[#1E2A38] text-slate-400 hover:text-white transition-colors"
              title="Rafraîchir les sessions"
            >
              <RefreshCw className={`w-4 h-4 ${sessionsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {sessionsLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF4A1C]" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-10 bg-[#0F1626]/50 rounded-2xl border border-[#1E2A38] border-dashed">
            <Laptop className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm font-medium">Aucune session active enregistrée.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.filter((session: any) => (session.session_status || 'active') === 'active').map((session: any) => {
              const parsed = parseUserAgent(session.user_agent);
              const browser = session.browser_version ? `${session.browser} ${session.browser_version}` : (session.browser || parsed.browser);
              const os = session.operating_system || parsed.os;
              const deviceType = session.device_type || parsed.device;
              const isMobile = deviceType === 'mobile' || parsed.device === 'Mobile';
              const isTablet = deviceType === 'tablet' || parsed.device === 'Tablette';
              const isCurrent = session.isCurrent;
              const sessionStatus = session.session_status || 'active';
              const isRevoked = sessionStatus === 'revoked';
              const isExpired = sessionStatus === 'expired';

              return (
                <div 
                  key={session.id} 
                  className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    isCurrent 
                      ? 'bg-gradient-to-r from-[#27C93F]/10 via-[#07111F] to-[#07111F] border-[#27C93F]/30 shadow-[0_0_15px_rgba(39,201,63,0.05)]' 
                      : 'bg-[#0F1626] border-[#1E2A38] hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                      isCurrent ? 'bg-[#27C93F]/20 text-[#27C93F] border border-[#27C93F]/30' : 'bg-[#07111F] text-slate-400 border border-[#1E2A38]'
                    }`}>
                      {isMobile ? <Smartphone className="w-5 h-5" /> : isTablet ? <Tablet className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{browser} sur {os}</span>
                        <span className="px-2.5 py-0.5 bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-[#FF4A1C] rounded-full text-[10px] font-bold flex items-center gap-1">
                          <span>👤</span>
                          <span>{session.user_email}</span>
                          <span className="text-slate-400 font-normal">({session.user_role === 'owner' ? 'Propriétaire' : session.user_role === 'admin' ? 'Admin' : 'Développeur'})</span>
                        </span>
                        {isCurrent && (
                          <span className="px-2.5 py-0.5 bg-[#27C93F]/20 text-[#27C93F] border border-[#27C93F]/30 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#27C93F]" />
                            Session Actuelle
                          </span>
                        )}
                        {isRevoked && (
                          <span className="px-2.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                            Session fermee
                          </span>
                        )}
                        {isExpired && (
                          <span className="px-2.5 py-0.5 bg-slate-500/10 text-slate-400 border border-slate-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                            Expiree
                          </span>
                        )}
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[10px] font-mono text-slate-300">
                          {session.login_method === 'passkey' ? '🔐 Passkey' : session.login_method === 'mobile-sso' ? '📱 Mobile' : '🔑 Mot de passe'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap font-medium">
                        <span className="font-mono bg-[#07111F] px-2 py-0.5 rounded border border-[#1E2A38] text-slate-300">{session.ip_address}</span>
                        <span>•</span>
                        <span>📍 {session.location || 'Haïti'}</span>
                        <span>•</span>
                        <span>Dernière activité: {new Date(session.last_active_at).toLocaleString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && sessionStatus === 'active' && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={async () => {
                        if (!confirm("Voulez-vous vraiment déconnecter cet appareil ?")) return;
                        setActionLoading(true);
                        try {
                          const res = await revokeSession(session.id);
                          if (res.error) throw new Error(res.error);
                          setSessions(sessions.map((s: any) => s.id === session.id ? {
                            ...s,
                            session_status: 'revoked',
                            status: 'revoked',
                            revoked_at: new Date().toISOString(),
                          } : s));
                          toast.success("Appareil déconnecté.");
                        } catch (e: any) {
                          toast.error(e.message || "Erreur lors de la déconnexion.");
                        } finally {
                          setActionLoading(false);
                        }
                      }}
                      className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all whitespace-nowrap self-end sm:self-auto disabled:opacity-50"
                    >
                      Déconnecter
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
