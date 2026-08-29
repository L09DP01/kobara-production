'use client'

import { useState } from 'react';
import { updatePayoutSettings } from '../actions';

export function PayoutSettings({ settings }: { settings: any }) {
  const generalSettings = settings?.settings_json || {};
  const [moncashNumber, setMoncashNumber] = useState(generalSettings.saved_moncash_number || '');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!moncashNumber) {
      setErrorMsg("Veuillez entrer un numéro MonCash valide.");
      return;
    }

    try {
      setIsSaving(true);
      await updatePayoutSettings(moncashNumber);
      setSuccessMsg("Votre compte de retrait a été mis à jour.");
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm overflow-hidden">
      <div className="p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-1">Comptes de Retrait</h2>
        <p className="text-sm text-slate-400 mb-8">
          Ajoutez un compte MonCash pour recevoir vos paiements plus rapidement. Pour l'instant, seul MonCash est supporté.
        </p>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] mt-0.5">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/20 text-green-400 text-sm flex items-start gap-3">
            <span className="material-symbols-outlined text-[20px] mt-0.5">check_circle</span>
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#eb1c24]/10 flex items-center justify-center border border-[#eb1c24]/20">
                <span className="text-[#eb1c24] font-bold text-xs tracking-tighter">MC</span>
              </div>
              <div>
                <h3 className="font-bold text-white">MonCash</h3>
                <p className="text-xs text-slate-400">Transfert instantané</p>
              </div>
              <div className="ml-auto">
                <span className="px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/20 text-xs font-bold">
                  Actif
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">Numéro de réception MonCash</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[20px]">
                      smartphone
                    </span>
                    <input 
                      type="tel" 
                      value={moncashNumber}
                      onChange={(e) => setMoncashNumber(e.target.value)}
                      placeholder="3xxxxxxx ou 4xxxxxxx"
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Ce numéro sera utilisé par défaut lors de vos demandes de retrait depuis le tableau de bord.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button 
              type="submit" 
              disabled={isSaving}
              className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-70 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Enregistrement...
                </>
              ) : (
                'Enregistrer le compte'
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3 mb-4 opacity-50 grayscale pointer-events-none">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
              <span className="material-symbols-outlined text-slate-400">account_balance</span>
            </div>
            <div>
              <h3 className="font-bold text-white">Virement Bancaire (Sogebank / Unibank)</h3>
              <p className="text-xs text-slate-400">Bientôt disponible</p>
            </div>
            <div className="ml-auto">
              <span className="px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-bold">
                Bientôt
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
