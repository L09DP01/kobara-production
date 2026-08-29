"use client";

import React, { useState } from "react";
import { ShieldAlert, Phone, Mail, HelpCircle, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SuspendedAccountViewProps {
  merchantEmail?: string;
  merchantName?: string;
  supportPhone?: string;
  supportEmail?: string;
}

export function SuspendedAccountView({
  merchantEmail,
  merchantName,
  supportPhone = "+509 3100 0000",
  supportEmail = "support@kobara.app",
}: SuspendedAccountViewProps) {
  const [subject, setSubject] = useState("Demande d'assistance - Compte suspendu");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmitSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          priority: "urgent",
          category: "account_suspended",
        }),
      });

      if (!res.ok) {
        throw new Error("Impossible d'envoyer le message. Veuillez réessayer ou utiliser le téléphone.");
      }

      setIsSuccess(true);
      setMessage("");
    } catch (err: any) {
      setErrorMessage(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] text-white flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white/[0.03] border border-red-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl backdrop-blur-xl relative overflow-hidden my-auto">
        {/* Glow effect */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center space-y-4">
          <div className="inline-flex p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <ShieldAlert className="w-12 h-12" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Compte temporairement suspendu
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl mx-auto">
            L'accès aux opérations financières de votre compte a été temporairement restreint pour vérification de sécurité et de conformité.
          </p>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs sm:text-sm text-left flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Une seule identité par compte Kobara</p>
              <p className="text-amber-200/80 mt-0.5">
                Nos systèmes de protection ont détecté des informations d'identité pouvant être liées à un autre compte. Vos fonds demeurent enregistrés en toute sécurité pendant l'examen de conformité.
              </p>
            </div>
          </div>
        </div>

        {/* Action Options */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Appel Téléphonique */}
          <a
            href={`tel:${supportPhone.replace(/\s+/g, '')}`}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white font-medium transition-all group"
          >
            <Phone className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="text-xs text-slate-400">Appel direct d'urgence</div>
              <div className="text-sm font-semibold">{supportPhone}</div>
            </div>
          </a>

          {/* Option 2: Email direct */}
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent("Urgent - Compte Suspendu (" + (merchantName || merchantEmail || "") + ")")}`}
            className="flex items-center justify-center gap-3 p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white font-medium transition-all group"
          >
            <Mail className="w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform" />
            <div className="text-left">
              <div className="text-xs text-slate-400">Email support officiel</div>
              <div className="text-sm font-semibold">{supportEmail}</div>
            </div>
          </a>
        </div>

        {/* Option 3: Formulaire d'envoi de message immédiat */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-orange-400" />
            Envoyer une demande d'aide à l'équipe conformité
          </h2>

          {isSuccess ? (
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Votre message a été transmis avec succès. Un agent de sécurité va traiter votre dossier en priorité.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmitSupport} className="space-y-3">
              <Input
                type="text"
                placeholder="Objet de la demande"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-white/5 border-white/10 text-white text-sm"
                required
              />

              <textarea
                placeholder="Expliquez votre situation ou fournissez des informations complémentaires pour faciliter la vérification..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white text-sm focus:outline-none focus:border-orange-500 min-h-[100px]"
                required
              />

              {errorMessage && (
                <p className="text-xs text-red-400">{errorMessage}</p>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !message.trim()}
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium py-2.5 rounded-xl transition-all shadow-lg"
              >
                {isSubmitting ? (
                  "Envoi en cours..."
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Send className="w-4 h-4" />
                    Transmettre ma demande d'assistance
                  </span>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
