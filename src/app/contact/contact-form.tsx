"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { TurnstileWidget } from "@/components/ui/turnstile-widget";

const fieldClass = "min-h-12 w-full rounded-md border border-[#D8D3CF] bg-white px-4 text-sm text-[#10131D] outline-none transition-colors placeholder:text-[#8A8C92] focus:border-[#F45D2C] focus:ring-2 focus:ring-[#F45D2C]/15";

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setReference("");

    if (!turnstileToken) {
      setError("Veuillez terminer la vérification de sécurité.");
      return;
    }

    setLoading(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const response = await fetch("/api/support/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          category: form.get("category"),
          subject: form.get("subject"),
          message: form.get("message"),
          website: form.get("website"),
          turnstileToken,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "L’envoi a échoué.");

      setReference(payload.reference);
      formElement.reset();
      setTurnstileToken("");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "L’envoi a échoué.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-md border border-[#D8D3CF] bg-white p-5 shadow-[0_20px_50px_rgba(16,19,29,0.07)] sm:p-8">
      <input name="website" type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="border-b border-[#DDD7D3] pb-6">
        <h2 className="text-2xl font-extrabold text-[#10131D]">Envoyez votre demande</h2>
        <p className="mt-2 text-sm leading-6 text-[#5C5E66]">Les champs nous permettent d’orienter votre message vers la bonne équipe.</p>
      </div>

      {reference && (
        <div className="mt-6 flex gap-3 rounded-md border border-[#A7D6C1] bg-[#EEF9F3] p-4 text-sm text-[#245440]" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Message reçu. Votre référence est <strong>{reference}</strong>.</p>
        </div>
      )}
      {error && <div className="mt-6 rounded-md border border-[#E8A49C] bg-[#FFF0EE] p-4 text-sm font-medium text-[#8B241B]" role="alert">{error}</div>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <Field label="Prénom"><input required name="firstName" type="text" maxLength={80} autoComplete="given-name" placeholder="Jean" className={fieldClass} /></Field>
        <Field label="Nom"><input required name="lastName" type="text" maxLength={80} autoComplete="family-name" placeholder="Pierre" className={fieldClass} /></Field>
      </div>

      <div className="mt-5">
        <Field label="Adresse e-mail"><input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="jean@entreprise.com" className={fieldClass} /></Field>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <Field label="Catégorie">
          <select required name="category" defaultValue="" className={`${fieldClass} cursor-pointer appearance-none`}>
            <option value="" disabled>Sélectionnez</option>
            <option value="support">Assistance technique</option>
            <option value="sales">Tarifs et ventes</option>
            <option value="partnership">Partenariat</option>
            <option value="other">Autre demande</option>
          </select>
        </Field>
        <Field label="Sujet"><input required name="subject" type="text" maxLength={255} placeholder="Objet de la demande" className={fieldClass} /></Field>
      </div>

      <div className="mt-5">
        <Field label="Message">
          <textarea required name="message" minLength={10} maxLength={10000} rows={6} placeholder="Décrivez votre demande sans inclure de mot de passe ni de données bancaires." className={`${fieldClass} resize-y py-3`} />
        </Field>
      </div>

      <div className="mt-6"><TurnstileWidget onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} onError={() => setTurnstileToken("")} /></div>

      <button disabled={loading || !turnstileToken} type="submit" className="kobara-cta mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-5 text-sm font-extrabold text-white transition-colors hover:bg-[#E22F23] disabled:cursor-not-allowed disabled:opacity-50">
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {loading ? "Envoi en cours…" : "Envoyer le message"}
        {!loading ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#333847]">
      <span className="mb-2 block">{label}</span>
      {children}
    </label>
  );
}
