'use client';

import { useState, useTransition } from 'react';
import { createPromoCode, togglePromoCodeStatus, deletePromoCode } from './actions';
import { Tag, Plus, CheckCircle, XCircle, Trash2, Calendar, Users, Briefcase } from 'lucide-react';

export default function PromoCodesClient({ promoCodes, plans, merchants }: { promoCodes: any[], plans: any[], merchants: any[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const formData = new FormData(e.currentTarget);
    
    startTransition(async () => {
      const res = await createPromoCode(formData);
      if (res.success) {
        setSuccess('Code promo créé avec succès');
        (e.target as HTMLFormElement).reset();
      } else {
        setError(res.error || 'Une erreur est survenue');
      }
    });
  };

  const handleToggle = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      await togglePromoCodeStatus(id, !currentStatus);
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Voulez-vous vraiment supprimer ce code ?')) {
      startTransition(async () => {
        await deletePromoCode(id);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Tag className="w-6 h-6 text-orange-500" />
          CODES PROMO
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Formulaire de création */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-400 flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4" />
              NOUVEAU CODE
            </h2>

            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg">{error}</div>}
            {success && <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-lg">{success}</div>}

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Code (ex: SUMMER50)</label>
              <input name="code" type="text" required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500 uppercase" />
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Réduction (%)</label>
              <input name="discount_percentage" type="number" step="0.01" min="1" max="100" required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input name="is_cumulable" type="checkbox" value="true" className="rounded border-slate-700 bg-slate-950" />
                Cumulable avec offre annuelle (-20%)
              </label>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input name="is_recurring" type="checkbox" value="true" className="rounded border-slate-700 bg-slate-950" />
                Récurrent (s'applique à chaque renouvellement)
              </label>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Plan cible (Optionnel)</label>
              <select name="plan_id" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500">
                <option value="">Tous les plans</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 mb-1 block">Marchand cible (Optionnel)</label>
              <select name="merchant_id" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500">
                <option value="">Tous les marchands</option>
                {merchants.map(m => <option key={m.id} value={m.id}>{m.business_name} ({m.email})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Usages max</label>
                <input name="max_uses" type="number" min="1" placeholder="Infini" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Expiration</label>
                <input name="expires_at" type="datetime-local" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-orange-500" />
              </div>
            </div>

            <button type="submit" disabled={isPending} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors mt-4">
              {isPending ? 'CRÉATION...' : 'CRÉER LE CODE'}
            </button>
          </form>
        </div>

        {/* Liste des codes */}
        <div className="lg:col-span-2 space-y-4">
          {promoCodes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
              Aucun code promo créé.
            </div>
          ) : (
            <div className="grid gap-4">
              {promoCodes.map(code => (
                <div key={code.id} className={`bg-slate-900 border rounded-xl p-5 flex items-center justify-between ${code.is_active ? 'border-slate-800' : 'border-slate-800/50 opacity-50'}`}>
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-black text-white tracking-wider bg-slate-800 px-3 py-1 rounded-md">{code.code}</h3>
                      <span className="text-lg font-bold text-green-400">-{code.discount_percentage}%</span>
                      {!code.is_active && <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">INACTIF</span>}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5" />
                        {code.plan ? code.plan.name : 'Tous les plans'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {code.merchant ? code.merchant.business_name : 'Tous les marchands'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {code.expires_at ? new Date(code.expires_at).toLocaleDateString() : 'Pas d\'expiration'}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
                        {code.current_uses} / {code.max_uses || '∞'} utilisés
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-3 text-xs">
                      {code.is_cumulable && <span className="text-orange-400">Cumulable Annuel</span>}
                      {code.is_recurring && <span className="text-blue-400">Récurrent</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <button 
                      onClick={() => handleToggle(code.id, code.is_active)}
                      disabled={isPending}
                      className={`text-xs px-3 py-1.5 rounded-md border font-bold transition-colors ${
                        code.is_active 
                          ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                          : 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                      }`}
                    >
                      {code.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                    <button 
                      onClick={() => handleDelete(code.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-red-500/20 text-red-400 hover:bg-red-500/10 font-bold transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
