'use client'

import { useState } from 'react';
import { useEnvironment } from '@/context/EnvironmentContext';

import Link from 'next/link';

export function ApiKeysClient({ 
  merchant,
  apiKeysLimit,
  initialKeys, 
  apiCallsThisWeek = 0, 
  successRate = 100 
}: { 
  merchant: any,
  apiKeysLimit: number | null,
  initialKeys: any[], 
  apiCallsThisWeek?: number, 
  successRate?: number 
}) {
  const [loading, setLoading] = useState(false);
  const { currentEnvironment, setEnvironment } = useEnvironment();
  const [showKey, setShowKey] = useState(false);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<{rawKey: string, name: string, environment: string} | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredKeys = initialKeys.filter(k => k.environment === currentEnvironment);

  const hasReachedLimit = apiKeysLimit !== null && filteredKeys.length >= apiKeysLimit;

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (hasReachedLimit) {
      setError(`Vous avez atteint la limite de ${apiKeysLimit} clé${apiKeysLimit === 1 ? '' : 's'} API pour ce plan. Révoquez une clé existante ou changez de plan.`);
      return;
    }
    if (!keyName.trim()) {
      setError("Veuillez entrer un nom pour la clé API.");
      return;
    }
    
    try {
      setLoading(true);
      setShowKey(false);
      setError(null);
      setSuccess(null);
      const response = await fetch('/api/dashboard/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim(), environment: currentEnvironment }),
      });
      const result = await response.json().catch(() => ({
        error: `Le serveur a retourné une réponse invalide (${response.status}).`,
      }));
      
      if (!response.ok || result.error) {
        setError(result.error || `Impossible de créer la clé API (${response.status}).`);
        return;
      }
      
      if (result.rawKey) {
        setNewKey(result as { rawKey: string, name: string, environment: string });
        setShowCreateModal(false);
        setKeyName('');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la génération de la clé");
    } finally {
      setLoading(false);
    }
  };

  const executeRevoke = async () => {
    if (!confirmRevokeId) return;
    try {
      setError(null);
      const response = await fetch('/api/dashboard/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmRevokeId }),
      });
      const result = await response.json().catch(() => ({
        error: `Le serveur a retourné une réponse invalide (${response.status}).`,
      }));
      
      if (!response.ok || result.error) {
        setError(result.error || `Impossible de révoquer la clé API (${response.status}).`);
        return;
      }
      
      setSuccess("La clé a été supprimée avec succès.");
      setTimeout(() => {
        setSuccess(null);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la suppression");
    } finally {
      setConfirmRevokeId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copié dans le presse-papiers !");
    setTimeout(() => setSuccess(null), 3000);
  };

  return (
    <div className="max-w-[1080px] w-full mx-auto flex flex-col gap-8 pb-12">
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Clés API</h1>
          <p className="text-sm text-slate-400 mt-1">Gérez vos clés secrètes pour l'intégration de l'API Kobara.</p>
        </div>
        
        {/* Mobile Environment Switcher */}
        <div className="sm:hidden flex items-center justify-between bg-white/5 px-4 py-3 rounded-2xl border border-white/10 shadow-sm mt-2">
          <span className={`text-sm font-bold ${currentEnvironment === 'test' ? 'text-amber-500' : 'text-slate-500'}`}>Mode Test</span>
          <button 
            onClick={() => setEnvironment(currentEnvironment === 'test' ? 'live' : 'test')}
            disabled={merchant?.kyc_status !== 'approved'}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${merchant?.kyc_status !== 'approved' ? 'opacity-50 cursor-not-allowed bg-white/10' : (currentEnvironment === 'live' ? 'bg-emerald-500' : 'bg-amber-500')}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${currentEnvironment === 'live' ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className={`text-sm font-bold ${currentEnvironment === 'live' ? 'text-emerald-500' : 'text-slate-500'}`}>Mode Live</span>
        </div>
      </div>

      {/* Security Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 flex items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-[0.03] text-blue-400">
          <span className="material-symbols-outlined text-[120px]">shield</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 relative z-10">
          <span className="material-symbols-outlined text-[22px] text-blue-400">shield_lock</span>
        </div>
        <div className="relative z-10">
          <h3 className="text-sm font-bold text-blue-400 mb-1">
            Gardez vos clés secrètes en sécurité
          </h3>
          <p className="text-xs text-blue-200/80 leading-relaxed max-w-3xl">
            Vos clés d'API secrètes peuvent effectuer n'importe quelle action sur votre compte. Ne les partagez pas, ne les intégrez pas dans du code côté client et ne les publiez pas sur des dépôts publics.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-red-400 text-[20px]">error</span>
          <p className="text-sm text-red-400 font-medium">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="material-symbols-outlined text-green-400 text-[20px]">check_circle</span>
          <p className="text-sm text-green-400 font-medium">{success}</p>
        </div>
      )}

      {/* New Key Banner */}
      {newKey && (
        <div className="bg-white/5 border border-green-500/20 rounded-2xl p-6 shadow-md border-l-4 border-l-green-500 animate-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-green-400 text-[24px]">key</span>
            <h3 className="text-lg font-bold text-white">Nouvelle Clé Secrète {newKey.environment === 'live' ? 'Live' : 'Test'}</h3>
          </div>
          <p className="text-sm text-slate-400 mb-5">Veuillez copier cette clé immédiatement. Vous ne pourrez plus la voir une fois cette page fermée.</p>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/5 border border-white/10 p-2 rounded-xl">
            <div className="flex-1 bg-[#131b2f] border border-white/10 rounded-lg px-4 py-3 font-mono text-sm text-white flex items-center justify-between">
              <span>{showKey ? newKey.rawKey : '•'.repeat(newKey.rawKey.length)}</span>
              <button 
                onClick={() => setShowKey(!showKey)}
                className="text-slate-400 hover:text-white transition-colors flex items-center p-1"
                title={showKey ? "Masquer la clé" : "Afficher la clé"}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showKey ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            <button 
              onClick={() => copyToClipboard(newKey.rawKey)}
              className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all font-semibold text-sm shadow-sm flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">content_copy</span>
              Copier la clé
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => setNewKey(null)} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              J'ai copié ma clé, fermer ce message
            </button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white/5 border border-white/10 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-transparent">
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Clés Secrètes</h2>
            <p className="text-sm text-slate-400">
              Ces clés permettent d'authentifier les requêtes API au nom de votre compte.
            </p>
          </div>
          <button 
            onClick={() => {
              if (hasReachedLimit) {
                setError(`Vous avez atteint la limite de ${apiKeysLimit} clé${apiKeysLimit === 1 ? '' : 's'} API pour ce plan. Révoquez une clé existante ou changez de plan.`);
              } else {
                setShowCreateModal(true);
              }
            }}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all disabled:opacity-50 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">vpn_key</span>
            Nouvelle clé secrète
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nom & Clé partielle</th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Statut</th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Créée le</th>
                <th className="py-3.5 px-6 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredKeys.length > 0 ? filteredKeys.map((key) => (
                <tr key={key.id} className={`hover:bg-white/5 transition-colors group ${key.revoked_at ? 'opacity-50' : ''} border-l-[3px] border-l-transparent hover:border-l-orange-500`}>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${key.revoked_at ? 'bg-white/10 text-slate-400' : 'bg-orange-500/20 text-orange-400'}`}>
                        <span className="material-symbols-outlined text-[18px]">key</span>
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{key.name}</div>
                        <div className="font-mono text-xs text-slate-400 mt-1 tracking-wide">
                          {key.revoked_at ? `${key.prefix}••••••••••• (Révoquée)` : `${key.prefix}•••••••••••`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {key.revoked_at ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-slate-400 text-[11px] font-bold">
                        <span className="material-symbols-outlined text-[14px]">block</span>
                        Révoquée
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6 text-sm text-slate-400 font-medium">
                    {new Date(key.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-4 px-6 text-right">
                    {!key.revoked_at && (
                      <button 
                        onClick={() => setConfirmRevokeId(key.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                        Révoquer
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 mx-auto flex items-center justify-center mb-4 border border-white/10">
                      <span className="material-symbols-outlined text-4xl text-slate-500/50">vpn_key_off</span>
                    </div>
                    <p className="text-sm text-white font-bold">Aucune clé API {currentEnvironment === 'test' ? 'de Test' : 'Live'} trouvée</p>
                    <p className="text-xs text-slate-400 mt-1">Générez une clé pour commencer à utiliser l'API.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Security Note Footer */}
        <div className="bg-white/[0.02] border-t border-white/5 p-4 flex items-start sm:items-center gap-3">
          <span className="material-symbols-outlined text-orange-400 text-[18px] shrink-0 mt-0.5 sm:mt-0">info</span>
          <p className="text-xs text-slate-400 leading-relaxed">
            Pour des raisons de sécurité, vous ne pouvez pas revoir ou copier une clé API une fois la page fermée. Si vous l'avez perdue, veuillez la <strong className="text-slate-300 font-semibold">révoquer</strong> et en créer une nouvelle.
          </p>
        </div>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Appels API cette semaine</p>
            <p className="text-3xl font-bold text-white">{apiCallsThisWeek}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-[24px]">stacked_line_chart</span>
          </div>
        </div>
        <div className="bg-white/5 rounded-3xl border border-white/10 p-6 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Taux de succès API</p>
            <p className="text-3xl font-bold text-white">{successRate}%</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
            <span className="material-symbols-outlined text-[24px]">network_check</span>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {confirmRevokeId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#131b2f] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mb-5 mx-auto border border-red-500/20">
              <span className="material-symbols-outlined text-[32px]">warning</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 text-center">Êtes-vous sûr ?</h3>
            <p className="text-sm text-slate-400 mb-8 text-center leading-relaxed">
              La révocation de cette clé est <strong>définitive</strong>. Toute application ou intégration utilisant cette clé cessera de fonctionner immédiatement.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmRevokeId(null)}
                className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl font-bold text-sm text-slate-400 hover:bg-white/5 transition-colors shadow-sm"
              >
                Annuler
              </button>
              <button 
                onClick={executeRevoke}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors shadow-sm"
              >
                Oui, révoquer la clé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#131b2f] w-full max-w-md rounded-3xl p-6 shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nouvelle clé {currentEnvironment === 'live' ? 'Live' : 'Test'}</h3>
              <button onClick={() => { setShowCreateModal(false); setKeyName(''); setError(null); }} className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/5 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-1">Nom de la clé</label>
                <input 
                  type="text" 
                  required
                  autoFocus
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0F1626] border border-white/10 rounded-xl text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500 transition-colors text-white shadow-sm"
                  placeholder="Ex: Backend Prod, Serveur de Test..."
                />
                <p className="text-xs text-slate-400 mt-2">Ce nom vous aidera à identifier l'utilisation de cette clé plus tard.</p>
              </div>
              
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-red-400 text-[20px] shrink-0 mt-0.5">error</span>
                  <div className="flex-1">
                    <p className="text-xs text-red-400 font-medium leading-relaxed">{error}</p>
                    {error.includes("limite") && (
                      <Link href="/dashboard/billing" className="inline-block mt-2 text-xs font-bold text-orange-400 hover:text-orange-300 underline">
                        Passer au plan supérieur &rarr;
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {hasReachedLimit && !error && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-[18px]">info</span>
                  <p className="text-xs text-amber-400">
                    Limite atteinte pour ce plan ({apiKeysLimit} clé{apiKeysLimit === 1 ? '' : 's'}). Révoquez une clé existante ou passez au plan supérieur.
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button 
                  type="button"
                  onClick={() => { setShowCreateModal(false); setKeyName(''); setError(null); }}
                  className="flex-1 px-4 py-2.5 border border-white/10 rounded-xl font-bold text-sm text-slate-400 hover:bg-white/5 transition-colors shadow-sm"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={loading || !keyName.trim() || hasReachedLimit}
                  className="flex-1 px-4 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
                      Génération...
                    </>
                  ) : "Générer la clé"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
