'use client';

import { useState, useEffect } from 'react';
import { 
  Zap, 
  ShieldCheck, 
  RefreshCw, 
  Smartphone, 
  Globe, 
  Terminal, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  ArrowRightLeft,
  Server,
  Lock,
  Cpu
} from 'lucide-react';
import { PaymentProviderConfig, DEFAULT_PROVIDER_CONFIG } from '@/types/payment-provider';

export default function AdminPaymentProviderPage() {
  const [config, setConfig] = useState<PaymentProviderConfig>(DEFAULT_PROVIDER_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingProviderSwitch, setPendingProviderSwitch] = useState<'bazik' | 'paym' | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-provider');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setConfig(data.config);
        }
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Impossible de charger la configuration.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updates: Partial<PaymentProviderConfig>) => {
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/payment-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setConfig(data.config);
        setSuccessMessage("Configuration mise à jour avec succès.");
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setErrorMessage(data.error || "Erreur lors de la mise à jour.");
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Erreur réseau.");
    } finally {
      setSaving(false);
      setPendingProviderSwitch(null);
    }
  };

  const isPaym = config.active_provider === 'paym';
  const isBazik = config.active_provider === 'bazik';

  return (
    <div className="space-y-8 font-mono pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-wider text-slate-100 flex items-center gap-2">
              <Layers className="w-6 h-6 text-red-500" />
              FOURNISSEURS DE PAIEMENT
            </h1>
            <span className="text-xs px-2.5 py-1 rounded bg-red-950/60 text-red-400 border border-red-800/40">
              CORE SWITCH
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Basculez entre le fournisseur legacy (Bazik) et le fournisseur unifié (Pay&apos;m) avec gestion du SMS Gateway et des modes USSD.
          </p>
        </div>

        <button
          onClick={fetchConfig}
          disabled={loading || saving}
          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded transition-all self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          RAFRAÎCHIR
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 text-sm flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded bg-red-950/40 border border-red-800/50 text-red-400 text-sm flex items-center gap-3 animate-in fade-in">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section 1 : Sélecteur Principal de Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Provider BAZIK */}
        <div 
          className={`relative p-6 rounded-lg border transition-all ${
            isBazik 
              ? 'bg-slate-900/90 border-blue-500/80 shadow-[0_0_25px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/30' 
              : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-100'
          }`}
        >
          {isBazik && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-blue-950/80 text-blue-400 border border-blue-800/50 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
              ACTIF EN PRODUCTION
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded bg-blue-950/60 border border-blue-800/40 flex items-center justify-center text-blue-400 font-bold">
              BZ
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">BAZIK (Legacy)</h3>
              <p className="text-xs text-slate-500">MonCash API + SMS Gateway NatCash</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400 mb-6 bg-slate-950/60 p-3 rounded border border-slate-850">
            <div className="flex items-center justify-between">
              <span>MonCash Paiement :</span>
              <span className="text-slate-300">Bazik API (Redirection)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>NatCash Paiement :</span>
              <span className="text-slate-300">SMS Gateway (Manuel/Android)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retraits MonCash :</span>
              <span className="text-emerald-400">Automatique (Bazik API)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retraits NatCash :</span>
              <span className="text-amber-400">Approbation Manuelle Admin</span>
            </div>
          </div>

          {!isBazik && (
            <button
              onClick={() => setPendingProviderSwitch('bazik')}
              disabled={saving}
              className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-300 text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-blue-500"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              BASCULER SUR BAZIK
            </button>
          )}
        </div>

        {/* Provider PAY'M */}
        <div 
          className={`relative p-6 rounded-lg border transition-all ${
            isPaym 
              ? 'bg-slate-900/90 border-red-500/80 shadow-[0_0_25px_rgba(220,38,38,0.15)] ring-1 ring-red-500/30' 
              : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-100'
          }`}
        >
          {isPaym && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-red-950/80 text-red-400 border border-red-800/50 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
              ACTIF EN PRODUCTION
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-400 font-bold">
              PM
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-100">PAY&apos;M (PlopPlop)</h3>
              <p className="text-xs text-slate-500">MonCash + NatCash API Unifiée (USSD & Web)</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-400 mb-6 bg-slate-950/60 p-3 rounded border border-slate-850">
            <div className="flex items-center justify-between">
              <span>MonCash Paiement :</span>
              <span className="text-slate-300">Pay&apos;m API (Web & USSD)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>NatCash Paiement :</span>
              <span className="text-slate-300">Pay&apos;m API (Web & USSD)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retraits MonCash :</span>
              <span className="text-emerald-400">100% Automatique (HMAC-SHA256)</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Retraits NatCash :</span>
              <span className="text-emerald-400">100% Automatique (HMAC-SHA256)</span>
            </div>
          </div>

          {!isPaym && (
            <button
              onClick={() => setPendingProviderSwitch('paym')}
              disabled={saving}
              className="w-full py-2.5 px-4 rounded bg-slate-800 hover:bg-red-600 hover:text-white text-slate-300 text-xs font-bold tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-700 hover:border-red-500"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              BASCULER SUR PAY&apos;M
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {pendingProviderSwitch && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-100">CONFIRMER LA BASCULE</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Vous êtes sur le point de basculer le fournisseur actif vers{' '}
              <strong className="text-white uppercase">{pendingProviderSwitch}</strong>.
            </p>

            <div className="bg-slate-950 p-3 rounded text-xs text-slate-400 space-y-1.5 border border-slate-800">
              {pendingProviderSwitch === 'paym' ? (
                <>
                  <p>• Les nouveaux paiements MonCash et NatCash passeront par l&apos;API Pay&apos;m.</p>
                  <p>• Le <strong>SMS Gateway NatCash</strong> sera automatiquement <strong>désactivé</strong>.</p>
                  <p>• Les retraits NatCash deviendront <strong>automatiques</strong>.</p>
                  <p>• Les paiements antérieurs créés sous Bazik pourront toujours être finalisés sans rupture.</p>
                </>
              ) : (
                <>
                  <p>• Les nouveaux paiements MonCash passeront par Bazik.</p>
                  <p>• Le <strong>SMS Gateway NatCash</strong> sera automatiquement <strong>réactivé</strong>.</p>
                  <p>• Les retraits NatCash repasseront en mode <strong>approbation manuelle</strong>.</p>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setPendingProviderSwitch(null)}
                disabled={saving}
                className="px-4 py-2 rounded text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 transition-all"
              >
                ANNULER
              </button>
              <button
                onClick={() => handleSave({ active_provider: pendingProviderSwitch })}
                disabled={saving}
                className="px-4 py-2 rounded text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                CONFIRMER LE SWITCH
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Section 2 : État du SMS Gateway NatCash */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-slate-300">
              <Terminal className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-200">SMS GATEWAY NATCASH</h3>
              <p className="text-xs text-slate-400">
                Interception des SMS via l&apos;application mobile passerelle Android
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded font-semibold ${
              config.sms_gateway_enabled 
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/50' 
                : 'bg-red-950/80 text-red-400 border border-red-800/50'
            }`}>
              {config.sms_gateway_enabled ? '● ACTIF (ÉCOUTE SMS)' : '○ DÉSACTIVÉ'}
            </span>

            <button
              onClick={() => handleSave({ sms_gateway_enabled: !config.sms_gateway_enabled })}
              disabled={saving || isPaym}
              className={`text-xs px-3 py-1.5 rounded transition-all border ${
                isPaym
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                  :
                config.sms_gateway_enabled 
                  ? 'bg-red-950/40 text-red-400 border-red-900/40 hover:bg-red-900/60' 
                  : 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40 hover:bg-emerald-900/60'
              }`}
            >
              {isPaym
                ? 'GÉRÉ PAR PAY\'M'
                : config.sms_gateway_enabled
                  ? 'FORCER DÉSACTIVATION'
                  : 'FORCER ACTIVATION'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed bg-slate-950 p-3 rounded border border-slate-850">
          ℹ️ <strong>Règle d&apos;automatisation :</strong> Lorsque le provider actif est <strong>Pay&apos;m</strong>, le SMS Gateway est automatiquement désactivé car Pay&apos;m gère nativement NatCash via son API directe. Lorsque vous revenez à <strong>Bazik</strong>, le SMS Gateway se réactive automatiquement.
        </p>
      </div>

      {/* Section 2.5 : Contrôle Global PayPal & Cartes Bancaires (USD) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-blue-950/80 border border-blue-800/40 flex items-center justify-center text-blue-400 font-bold">
              PP
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-200">PAYPAL & CARTES BANCAIRES (USD)</h3>
              <p className="text-xs text-slate-400">
                Active le service international pour tous les marchands. Les autorisations individuelles restent actives lorsque ce réglage est arrêté.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded font-semibold ${
              config.paypal_global_enabled 
                ? 'bg-blue-950/80 text-blue-400 border border-blue-800/50' 
                : 'bg-slate-950 text-slate-500 border border-slate-800'
            }`}>
              {config.paypal_global_enabled ? '● ACTIF POUR TOUS' : '○ ACCÈS INDIVIDUEL'}
            </span>

            <button
              onClick={() => handleSave({ paypal_global_enabled: !config.paypal_global_enabled })}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded font-bold transition-all border ${
                config.paypal_global_enabled 
                  ? 'bg-red-950/40 text-red-400 border-red-900/40 hover:bg-red-900/60' 
                  : 'bg-blue-950/40 text-blue-400 border-blue-900/40 hover:bg-blue-900/60'
              }`}
            >
              {config.paypal_global_enabled ? 'DÉSACTIVER POUR TOUS' : 'ACTIVER POUR TOUS'}
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed bg-slate-950 p-3 rounded border border-slate-850">
          ℹ️ <strong>Règle de visibilité :</strong> Activé ici, le service est disponible pour tous. Désactivé ici, seuls les marchands autorisés <strong>individuellement</strong> sur leur fiche restent actifs jusqu&apos;à la désactivation de leur autorisation.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <label className="space-y-2 text-xs text-slate-400">
            <span className="block font-semibold text-slate-300">Taux HTG pour 1 USD</span>
            <input
              type="number"
              min="1"
              max="1000"
              step="0.01"
              value={config.paypal_htg_per_usd}
              onChange={(event) => setConfig((current) => ({ ...current, paypal_htg_per_usd: Number(event.target.value) }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="space-y-2 text-xs text-slate-400">
            <span className="block font-semibold text-slate-300">Frais Kobara (%)</span>
            <input
              type="number"
              min="0"
              max="25"
              step="0.01"
              value={config.paypal_fee_percent}
              onChange={(event) => setConfig((current) => ({ ...current, paypal_fee_percent: Number(event.target.value) }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="space-y-2 text-xs text-slate-400">
            <span className="block font-semibold text-slate-300">Frais fixe Kobara (USD)</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={config.paypal_fee_fixed_usd}
              onChange={(event) => setConfig((current) => ({ ...current, paypal_fee_fixed_usd: Number(event.target.value) }))}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => handleSave({
            paypal_htg_per_usd: config.paypal_htg_per_usd,
            paypal_fee_percent: config.paypal_fee_percent,
            paypal_fee_fixed_usd: config.paypal_fee_fixed_usd,
          })}
          disabled={saving}
          className="mt-4 px-4 py-2 rounded bg-blue-600 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          ENREGISTRER LE TAUX ET LES FRAIS
        </button>
      </div>

      {/* Section 3 : Méthodes Pay'm Détaillées (Toggles Granulaires) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-slate-800 flex items-center justify-center text-red-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-200">MÉTHODES DE PAIEMENT PAY&apos;M</h3>
              <p className="text-xs text-slate-400">
                Configurez les 3 méthodes prises en charge par l&apos;API Pay&apos;m
              </p>
            </div>
          </div>

          <span className="text-[11px] text-slate-500">
            {isPaym ? 'Appliqué immédiatement en production' : 'Sera appliqué lors du switch Pay\'m'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* MonCash Web */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-slate-200">MonCash Web Redirect</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Code: <code className="text-slate-300">moncash</code>. Redirige le client vers la page officielle MonCash.
              </p>
            </div>

            <button
              onClick={() => handleSave({ paym_moncash_web: !config.paym_moncash_web })}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded font-bold transition-all border ${
                config.paym_moncash_web 
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60' 
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {config.paym_moncash_web ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
            </button>
          </div>

          {/* MonCash USSD */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-slate-200">MonCash USSD Push</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Code: <code className="text-slate-300">moncash_ussd</code>. Invite USSD sur le téléphone + <strong>Loader In-App Kobara</strong>.
              </p>
            </div>

            <button
              onClick={() => handleSave({ paym_moncash_ussd: !config.paym_moncash_ussd })}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded font-bold transition-all border ${
                config.paym_moncash_ussd 
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60' 
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {config.paym_moncash_ussd ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
            </button>
          </div>

          {/* NatCash Web */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-bold text-slate-200">NatCash Web Redirect</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Code: <code className="text-slate-300">natcash</code>. Redirige le client vers la page officielle NatCash.
              </p>
            </div>

            <button
              onClick={() => handleSave({ paym_natcash_web: !config.paym_natcash_web })}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded font-bold transition-all border ${
                config.paym_natcash_web 
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60' 
                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {config.paym_natcash_web ? 'ACTIVÉ' : 'DÉSACTIVÉ'}
            </button>
          </div>

          {/* NatCash USSD is not part of the Pay'm v1.6 API contract. */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold text-slate-200">NatCash USSD Push</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cette méthode n&apos;est pas prise en charge par l&apos;API Pay&apos;m v1.6. Utilisez NatCash Web ou le SMS Gateway avec Bazik.
              </p>
            </div>

            <span className="shrink-0 text-xs px-3 py-1.5 rounded font-bold border bg-slate-900 text-slate-500 border-slate-800">
              INDISPONIBLE
            </span>
          </div>
        </div>
      </div>

      {/* Section 4 : Diagnostic Variables d'environnement */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-6">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-4">
          <Server className="w-4 h-4 text-slate-400" />
          RÉFÉRENCES VARIABLES D&apos;ENVIRONNEMENT
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-3 rounded border border-slate-850 space-y-1">
            <div className="font-bold text-slate-200">Variables Pay&apos;m :</div>
            <div className="text-slate-400">• PAYM_API_URL <span className="text-slate-600">(Défaut: https://plopplop.solutionip.app)</span></div>
            <div className="text-slate-400">• PAYM_CLIENT_ID <span className="text-slate-600">(Format: pp_...)</span></div>
            <div className="text-slate-400">• PAYM_CLIENT_SECRET <span className="text-slate-600">(Clé HMAC 64 chars)</span></div>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-850 space-y-1">
            <div className="font-bold text-slate-200">Variables Bazik & SMS :</div>
            <div className="text-slate-400">• BAZIK_USER_ID</div>
            <div className="text-slate-400">• BAZIK_SECRET_KEY / BAZIK_API_URL</div>
            <div className="text-slate-400">• SMS_GATEWAY_SECRET</div>
          </div>
        </div>
      </div>
    </div>
  );
}
