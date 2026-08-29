'use client';

import { useState } from 'react';
import { ShieldAlert, CreditCard, Landmark, CheckCircle2, Clock, Mail, Phone, AlertTriangle } from 'lucide-react';

interface ClosurePayoutViewProps {
  merchantEmail: string;
  merchantName: string;
  availableBalance: number;
  payoutStatus?: string;
  payoutDetails?: any;
  payoutDeadline?: string;
  supportEmail: string;
  supportPhone: string;
}

export function ClosurePayoutView({
  merchantEmail,
  merchantName,
  availableBalance,
  payoutStatus = 'pending_instructions',
  payoutDetails = {},
  payoutDeadline,
  supportEmail,
  supportPhone,
}: ClosurePayoutViewProps) {
  const [method, setMethod] = useState<'moncash' | 'natcash' | 'bank'>('moncash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(payoutStatus === 'instructions_submitted');
  const [error, setError] = useState<string | null>(null);

  const formattedBalance = new Intl.NumberFormat('fr-HT', { style: 'currency', currency: 'HTG' }).format(availableBalance);
  
  const deadlineDate = payoutDeadline 
    ? new Date(payoutDeadline).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Dans 190 jours';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || !accountName) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/support/closure-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payoutMethod: method,
          payoutAccountNumber: accountNumber,
          payoutAccountName: accountName,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Échec de la soumission");

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors de la transmission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 md:p-6 font-sans">
      <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Procédure de Clôture & Restitution des Fonds</h1>
            <p className="text-xs text-slate-400">Compte : <span className="font-semibold text-slate-300">{merchantName}</span> ({merchantEmail})</p>
          </div>
        </div>

        {/* Solde & Explication Norme AML */}
        <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Solde Restant à Restituer</span>
            <div className="text-2xl font-extrabold text-white">{formattedBalance}</div>
            <p className="text-xs text-slate-400">
              Réservé jusqu'au <strong className="text-amber-300">{deadlineDate}</strong> (Période légale de 190 jours).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-lg text-slate-300">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Conformité GAFI / BRH</span>
          </div>
        </div>

        {/* Status : Déjà soumis */}
        {submitted || payoutStatus === 'instructions_submitted' ? (
          <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-5 space-y-3 text-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Instructions de Versement Transmises</h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Vos coordonnées de règlement ont bien été enregistrées. L'équipe de conformité vérifie l'identité du bénéficiaire et procédera au virement sous 3 à 5 jours ouvrés.
            </p>
            <div className="pt-2 text-xs text-slate-400 font-mono">
              Méthode : {payoutDetails.payoutMethod || method} | Compte : {payoutDetails.payoutAccountNumber || accountNumber}
            </div>
          </div>
        ) : (
          /* Formulaire de saisie des coordonnées */
          <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-sm font-bold text-slate-200">Indiquez le compte où verser vos fonds :</h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Choix du mode */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMethod('moncash')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  method === 'moncash'
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>MonCash</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('natcash')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  method === 'natcash'
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>NatCash</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod('bank')}
                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-2 transition-all ${
                  method === 'bank'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <Landmark className="w-5 h-5" />
                <span>Virement</span>
              </button>
            </div>

            {/* Numéro de compte / Téléphone */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {method === 'bank' ? 'Numéro de compte bancaire / IBAN' : 'Numéro de téléphone (MonCash / NatCash)'}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={method === 'bank' ? '00123-4567-89012' : '+509 3123-4567'}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            {/* Nom du bénéficiaire */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Nom complet du titulaire du compte</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Jean Baptiste"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? 'Transmission en cours...' : 'Valider mes informations de versement'}
            </button>
          </form>
        )}

        {/* Footer Support */}
        <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /> {supportPhone}</span>
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-slate-500" /> {supportEmail}</span>
          </div>
          <a href="/logout" className="text-red-400 hover:underline">Déconnexion</a>
        </div>
      </div>
    </div>
  );
}
