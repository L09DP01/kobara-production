"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Fingerprint, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface PasskeyPromptModalProps {
  merchantId?: string;
  hasPasskey: boolean;
}

export function PasskeyPromptModal({ merchantId, hasPasskey }: PasskeyPromptModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If user already has a passkey or no merchantId, never show
    if (hasPasskey || !merchantId) return;

    // Check if prompt was already dismissed today (once per day rule)
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const storageKey = `kobara_passkey_prompt_${merchantId}`;
    const lastDismissed = localStorage.getItem(storageKey);

    if (lastDismissed !== today) {
      // Show modal after 1.5s delay for smooth entrance
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasPasskey, merchantId]);

  const handleDismiss = () => {
    if (merchantId) {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem(`kobara_passkey_prompt_${merchantId}`, today);
    }
    setIsOpen(false);
  };

  const handleAddPasskey = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!window.isSecureContext || !navigator.credentials) {
        throw new Error("Passkey nécessite un environnement HTTPS sécurisé ou localhost.");
      }

      const { startRegistration } = await import("@simplewebauthn/browser");

      // 1. Generate registration options
      const resp = await fetch("/api/auth/passkey/generate-registration-options");
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur de génération des options Passkey");
      }
      const options = await resp.json();

      // 2. Browser WebAuthn prompt
      const attResp = await startRegistration(options);

      // 3. Verify registration
      const verifyResp = await fetch("/api/auth/passkey/verify-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attResp),
      });

      if (!verifyResp.ok) {
        const errData = await verifyResp.json().catch(() => ({}));
        throw new Error(errData.error || "Échec de la vérification du Passkey");
      }

      setSuccess(true);
      
      // Mark as dismissed/completed so it won't show again
      if (merchantId) {
        const today = new Date().toISOString().split("T")[0];
        localStorage.setItem(`kobara_passkey_prompt_${merchantId}`, today);
      }
      
      // Auto close after 2 seconds
      setTimeout(() => {
        setIsOpen(false);
      }, 2000);

    } catch (err: any) {
      console.error("Passkey modal registration error:", err);
      if (err.name === "NotAllowedError") {
        setError("L'enregistrement biométrique a été annulé.");
      } else {
        setError(err.message || "Impossible d'ajouter le Passkey.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-[#0B1426] border border-[#1E2A38] rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(255,74,28,0.15)] text-white overflow-hidden">
        
        {/* Glow effect in background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#FF4A1C]/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#27C93F]/10 border border-[#27C93F]/30 rounded-2xl flex items-center justify-center mx-auto text-[#27C93F]">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white">Passkey ajouté avec succès !</h3>
            <p className="text-sm text-slate-400">
              Votre compte est désormais sécurisé avec la biométrie. Vous pourrez vous connecter en un instant sans mot de passe.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Icon */}
            <div className="w-14 h-14 bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 rounded-2xl flex items-center justify-center text-[#FF4A1C]">
              <Fingerprint className="w-7 h-7" />
            </div>

            {/* Title & Description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-[#FF4A1C]/10 text-[#FF4A1C] border border-[#FF4A1C]/20 rounded-full">
                  Recommandation Sécurité
                </span>
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Sécurisez votre compte avec Passkey
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                Connectez-vous instantanément grâce à votre empreinte digitale, Face ID ou clé de sécurité. Plus rapide et bien plus sécurisé qu'un mot de passe.
              </p>
            </div>

            {/* Benefits */}
            <div className="space-y-2.5 bg-[#07111F] border border-[#1E2A38] rounded-2xl p-4 text-xs text-slate-300">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#FF4A1C] shrink-0" />
                <span>Protection maximale contre le phishing</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Fingerprint className="w-4 h-4 text-[#FF4A1C] shrink-0" />
                <span>Connexion en 1 seconde via Face ID / Touch ID</span>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="p-3.5 bg-[#FF5F56]/10 border border-[#FF5F56]/30 rounded-xl flex items-center gap-3 text-xs text-[#FF5F56]">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleAddPasskey}
                disabled={loading}
                className="flex-1 h-12 bg-[#FF4A1C] hover:bg-[#FF2E14] text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    Ajouter maintenant
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                disabled={loading}
                className="h-12 px-5 bg-[#07111F] hover:bg-[#1E2A38] text-slate-400 hover:text-white border border-[#1E2A38] rounded-xl font-semibold text-sm transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
