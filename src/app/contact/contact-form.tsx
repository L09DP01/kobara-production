'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import { TurnstileWidget } from '@/components/ui/turnstile-widget';

export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setReference('');

    if (!turnstileToken) {
      setError('Veuillez terminer la vérification de sécurité.');
      return;
    }

    setLoading(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch('/api/support/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.get('firstName'),
          lastName: form.get('lastName'),
          email: form.get('email'),
          category: form.get('category'),
          subject: form.get('subject'),
          message: form.get('message'),
          website: form.get('website'),
          turnstileToken,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "L'envoi a échoué.");

      setReference(payload.reference);
      formElement.reset();
      setTurnstileToken('');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "L'envoi a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = 'w-full h-13 px-5 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white placeholder:text-[#657184] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all';

  return (
    <form onSubmit={submit} className="bg-[#07111F] border border-[#1E2A38] rounded-[24px] p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#FF4A1C]/5 rounded-full blur-[80px] pointer-events-none" />
      <input name="website" type="text" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {reference && (
        <div className="relative z-10 flex gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>Message reçu. Votre référence est <strong>{reference}</strong>.</p>
        </div>
      )}
      {error && (
        <div className="relative z-10 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200" role="alert">{error}</div>
      )}

      <div className="grid sm:grid-cols-2 gap-5 relative z-10">
        <div>
          <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Prénom</label>
          <input required name="firstName" type="text" maxLength={80} autoComplete="given-name" placeholder="Jean" className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Nom</label>
          <input required name="lastName" type="text" maxLength={80} autoComplete="family-name" placeholder="Pierre" className={inputClass} />
        </div>
      </div>
      <div className="relative z-10">
        <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Adresse e-mail</label>
        <input required name="email" type="email" maxLength={254} autoComplete="email" placeholder="jean@example.com" className={inputClass} />
      </div>
      <div className="relative z-10">
        <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Catégorie</label>
        <select required name="category" defaultValue="" className={`${inputClass} appearance-none`}>
          <option value="" disabled>Sélectionnez une catégorie</option>
          <option value="support">Assistance technique</option>
          <option value="sales">Tarifs et ventes</option>
          <option value="partnership">Partenariat</option>
          <option value="other">Autre demande</option>
        </select>
      </div>
      <div className="relative z-10">
        <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Sujet</label>
        <input required name="subject" type="text" maxLength={255} placeholder="Comment pouvons-nous vous aider ?" className={inputClass} />
      </div>
      <div className="relative z-10">
        <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Message</label>
        <textarea required name="message" minLength={10} maxLength={10000} rows={5} placeholder="Décrivez votre demande sans inclure de mot de passe ni de données bancaires." className={`${inputClass} h-auto py-4 resize-y`} />
      </div>

      <TurnstileWidget
        onVerify={setTurnstileToken}
        onExpire={() => setTurnstileToken('')}
        onError={() => setTurnstileToken('')}
      />
      <button disabled={loading || !turnstileToken} type="submit" className="w-full h-14 rounded-xl bg-[#FF4A1C] hover:bg-[#FF2E14] disabled:cursor-not-allowed disabled:opacity-50 text-white font-bold text-[16px] transition-colors flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(255,74,28,0.3)] relative z-10">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
        {loading ? 'Envoi en cours...' : 'Envoyer le message'}
      </button>
    </form>
  );
}
