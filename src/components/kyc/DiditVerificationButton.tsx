"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Loader2, ArrowRight } from 'lucide-react';

interface DiditVerificationButtonProps {
  buttonText?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  onSuccess?: () => void;
}

export function DiditVerificationButton({
  buttonText = "Commencer la vérification d'identité",
  className = "",
  variant = "default",
}: DiditVerificationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartVerification = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/kyc/didit/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Impossible d'initialiser la session de vérification.");
      }

      // Redirection directe fluide vers la page de vérification sécurisée
      // Évite tout blocage d'iframe X-Frame-Options et garantit un accès caméra optimal
      window.location.href = data.url;
    } catch (err: any) {
      console.error("[Didit KYC Button] Erreur:", err);
      setError(err.message || "Une erreur est survenue lors de l'ouverture de la vérification.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="p-3 mb-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center">
          {error}
        </div>
      )}

      <Button
        onClick={handleStartVerification}
        disabled={loading}
        className={
          variant === 'default'
            ? `w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-3.5 h-auto shadow-lg shadow-orange-500/20 transition-all ${className}`
            : className
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Redirection vers l'espace sécurisé...
          </>
        ) : (
          <>
            <ShieldCheck className="w-5 h-5 mr-2" />
            {buttonText}
            <ArrowRight className="w-4 h-4 ml-2" />
          </>
        )}
      </Button>
    </div>
  );
}
