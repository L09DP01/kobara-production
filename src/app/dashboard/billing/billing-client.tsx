'use client';

import { useState, useEffect } from 'react';
import { Check, Zap, ArrowRight, AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from "sonner";

export function BillingClient() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isYearly, setIsYearly] = useState(false);
  const [upgradeIntent, setUpgradeIntent] = useState<{ planSlug: string, isYearly: boolean } | null>(null);
  const [natcashData, setNatcashData] = useState<{ referenceCode: string, paymentId: string } | null>(null);
  
  const [showTranscodeInput, setShowTranscodeInput] = useState(false);
  const [transCode, setTransCode] = useState('');
  const [verifyingTransCode, setVerifyingTransCode] = useState(false);

  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [verifyingPromo, setVerifyingPromo] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [billingRes, plansRes] = await Promise.all([
          fetch('/api/dashboard/billing'),
          fetch('/api/plans')
        ]);
        
        if (!billingRes.ok) throw new Error('Erreur chargement facturation');
        if (!plansRes.ok) throw new Error('Erreur chargement plans');

        const billingData = await billingRes.json();
        const plansData = await plansRes.json();

        setData(billingData.data);
        setPlans(plansData.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleUpgradeClick = (p: any) => {
    if (p.price_htg === 0) {
      handleUpgrade(p.slug, 'monthly', 'moncash');
    } else {
      setUpgradeIntent({ planSlug: p.slug, isYearly });
    }
  };

  const handleUpgrade = async (planSlug: string, billingCycle: string, paymentMethod: string) => {
    setUpgrading(true);
    setActionError(null);
    try {
      const payload: any = { planSlug, billingCycle, paymentMethod };
      if (appliedPromo) {
        payload.promoCode = appliedPromo.code;
      }

      const res = await fetch('/api/dashboard/billing/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json().catch(() => ({
        error: `Le serveur a retourné une réponse invalide (${res.status}).`,
      }));
      if (!res.ok) {
        throw new Error(result.error || `Le changement de plan a échoué (${res.status}).`);
      }
      
      if (result.requiresPayment) {
        if (result.method === 'natcash' && result.referenceCode) {
          setUpgradeIntent(null);
          setNatcashData({ referenceCode: result.referenceCode, paymentId: result.paymentId });
          setUpgrading(false);
          return;
        } else if (result.paymentUrl) {
          window.location.href = result.paymentUrl;
          return;
        }
      }

      toast.success('Plan mis à jour avec succès !');
      window.location.reload();
    } catch (err: any) {
      const message = err.message || 'Le changement de plan a échoué. Veuillez réessayer.';
      setActionError(message);
      toast.error(message);
      setUpgrading(false);
    }
  };

  const handleVerifyPromo = async () => {
    if (!promoCode.trim() || !upgradeIntent) return;
    setVerifyingPromo(true);
    setPromoError(null);
    try {
      const res = await fetch('/api/promo-codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          promoCode: promoCode.trim(), 
          planSlug: upgradeIntent.planSlug,
          billingCycle: upgradeIntent.isYearly ? 'yearly' : 'monthly'
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Code invalide');
      
      setAppliedPromo({
        code: promoCode.trim(),
        discount: result.discount_percentage,
        originalPrice: result.original_price,
        finalPrice: result.final_price
      });
      setPromoError(null);
      toast.success(`Code promo appliqué ! (-${result.discount_percentage}%)`);
    } catch (err: any) {
      setPromoError(err.message);
      setAppliedPromo(null);
    } finally {
      setVerifyingPromo(false);
    }
  };

  const handleVerifyTransCode = async () => {
    if (!transCode.trim() || !natcashData) return;
    setVerifyingTransCode(true);
    
    try {
      const res = await fetch('/api/payments/verify-natcash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: natcashData.paymentId, transCode: transCode.trim() })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erreur lors de la vérification');
      
      toast.success(result.message || 'Paiement validé avec succès !');
      setNatcashData(null);
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifyingTransCode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-kobara-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-white/5 border border-red-500/20 rounded-3xl p-8 max-w-2xl mx-auto shadow-sm mt-8">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Oops! Une erreur est survenue</h2>
        <p className="text-slate-400 text-center mb-6 max-w-md">
          {error}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { merchant, plan, subscription, entitlement, usage } = data;
  const isKycApproved = merchant.kyc_status === 'approved';

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Facturation & Plans</h1>
        <p className="text-slate-400 mt-1">Gérez votre abonnement et vos limites d'utilisation.</p>
      </div>

      {/* KYC Alert */}
      {!isKycApproved && (
        <div className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-400">Vérification KYC requise</h3>
            <p className="text-amber-500 text-sm mt-1 mb-3">
              Votre compte est actuellement en mode test. Vous devez compléter votre profil et faire valider votre KYC pour choisir un plan et passer en mode Live.
            </p>
            <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors">
              Compléter mon profil
            </button>
          </div>
        </div>
      )}

      {(entitlement?.isGracePeriod || entitlement?.isExpired || entitlement?.reason === 'invalid_period') && (
        <div className={`flex items-start justify-between gap-4 rounded-lg border p-5 ${entitlement.isGracePeriod ? 'border-amber-500/30 bg-amber-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${entitlement.isGracePeriod ? 'text-amber-400' : 'text-red-400'}`} />
            <div>
              <p className="font-bold text-white">Votre abonnement {entitlement.subscriptionPlan || 'Premium'} a expiré.</p>
              <p className="mt-1 text-sm text-slate-300">
                {entitlement.isGracePeriod
                  ? `Vos droits restent actifs exceptionnellement jusqu’au ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(entitlement.gracePeriodEnd))}.`
                  : 'Vous utilisez maintenant le plan gratuit. Renouvelez pour récupérer les fonctionnalités Premium.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Overview */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Plan Actuel</h3>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-black text-white">
              {plan ? plan.name : 'Mode Test'}
            </span>
            {plan && (
              <span className="text-sm font-medium text-slate-400 mb-1">
                {plan.price_htg} HTG / mois
                {subscription?.billing_cycle === 'yearly' && <span className="ml-2 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full border border-orange-400/20">Annuel</span>}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mb-6">
            {plan ? plan.description : 'Le mode test vous permet de tester l\'intégration de Kobara sans frais.'}
          </p>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-bold">Statut</span>
              <span className={`font-bold ${entitlement?.isGracePeriod ? 'text-amber-400' : entitlement?.isExpired ? 'text-red-400' : 'text-green-400'}`}>
                {entitlement?.isGracePeriod ? 'Délai de grâce' : entitlement?.isExpired ? 'Expiré' : merchant.plan_status === 'active' ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-bold">Frais de transaction</span>
              <span className="font-bold text-white">{plan ? `${plan.transaction_fee_percent}%` : 'N/A'}</span>
            </div>
          </div>
          {(entitlement?.isExpired || entitlement?.isGracePeriod || entitlement?.reason === 'expired') && plan && plan.slug !== 'free' && (
            <button
              onClick={() => handleUpgradeClick(plan)}
              className="mt-4 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 fill-white" />
              Renouveler cet abonnement
            </button>
          )}
        </div>

        {/* Usage Card */}
        <div className="bg-white/5 p-6 rounded-3xl border border-white/10 shadow-sm">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Utilisation ce mois</h3>
          <div className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-bold text-white">Paiements (Volume)</span>
                <span className="text-slate-400 font-medium">
                  {usage.monthly_payments} / {plan?.monthly_payment_limit === null ? '∞' : plan?.monthly_payment_limit || '0'}
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all" 
                  style={{ width: plan?.monthly_payment_limit ? `${Math.min(100, (usage.monthly_payments / plan.monthly_payment_limit) * 100)}%` : '0%' }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-bold text-white">Clés API</span>
                <span className="text-slate-400 font-medium">
                  {usage.api_keys} / {plan?.api_keys_limit === null ? '∞' : plan?.api_keys_limit || '0'}
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all" 
                  style={{ width: plan?.api_keys_limit ? `${Math.min(100, (usage.api_keys / plan.api_keys_limit) * 100)}%` : '0%' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plans List */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h3 className="text-xl font-bold text-white">Changer de plan</h3>
          <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl transition-colors ${!isYearly ? "bg-[#1E2A38] text-white shadow-sm" : "text-slate-400 cursor-pointer"}`} onClick={() => setIsYearly(false)}>
              Mensuel
            </span>
            <span className={`text-sm font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-2 ${isYearly ? "bg-[#1E2A38] text-white shadow-sm" : "text-slate-400 cursor-pointer"}`} onClick={() => setIsYearly(true)}>
              Annuel
              <span className="text-[10px] uppercase bg-orange-500/20 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/30">
                -20%
              </span>
            </span>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((p) => {
            const currentBillingCycle = subscription?.billing_cycle || 'monthly';
            const isCurrent = plan?.slug === p.slug && currentBillingCycle !== (isYearly ? 'yearly' : 'monthly');
            const isExactCurrent = plan?.slug === p.slug && currentBillingCycle === (isYearly ? 'yearly' : 'monthly');
            const isPlanExpiredOrGrace = Boolean(
              entitlement?.isExpired ||
              entitlement?.isGracePeriod ||
              entitlement?.reason === 'expired' ||
              entitlement?.reason === 'grace_period'
            );
            const isExactCurrentActive = isExactCurrent && !isPlanExpiredOrGrace;
            const isActionDisabled = isExactCurrentActive || upgrading || (!isKycApproved && p.slug !== 'free');

            let buttonLabel = 'Choisir ce plan';
            if (isExactCurrent) {
              buttonLabel = isPlanExpiredOrGrace ? 'Renouveler ce plan' : 'Plan Actuel';
            }
            
            let displayPrice = p.price_htg;
            if (p.price_htg > 0 && isYearly) {
              displayPrice = p.price_htg * 0.8;
            }

            return (
              <div key={p.id} className={`bg-white/5 rounded-3xl border-2 flex flex-col p-6 transition-all ${isExactCurrent ? 'border-orange-500 shadow-sm' : 'border-white/10'}`}>
                <h4 className="font-black text-lg mb-1 text-white">{p.name}</h4>
                <div className="mb-4">
                  <div className="text-2xl font-black text-white">
                    {displayPrice.toLocaleString('fr-FR')} <span className="text-sm text-slate-400 font-medium">HTG/mois</span>
                  </div>
                  {p.price_htg > 0 && isYearly && (
                    <div className="text-xs text-green-400 font-medium mt-1">
                      Facturé {(displayPrice * 12).toLocaleString('fr-FR')} HTG / an
                    </div>
                  )}
                </div>
                
                <ul className="space-y-3 mb-6 flex-1 text-sm text-slate-400 font-medium">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> {p.transaction_fee_percent}% par transaction</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> {p.monthly_payment_limit || '∞'} paiements / mois</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Retrait max: {p.daily_withdrawal_limit || '∞'} HTG</li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-400" /> Clés API: {p.api_keys_limit || '∞'}</li>
                </ul>

                <button
                  disabled={isActionDisabled}
                  onClick={() => handleUpgradeClick(p)}
                  className={`w-full py-2.5 rounded-xl font-bold transition-all shadow-sm
                    ${isExactCurrentActive ? 'bg-white/10 text-slate-500 cursor-not-allowed shadow-none' : 
                      (!isKycApproved && p.slug !== 'free' ? 'bg-white/10 text-slate-500 cursor-not-allowed shadow-none' :
                      'bg-orange-500 text-white hover:bg-orange-600')}
                  `}
                >
                  {buttonLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Choix du moyen de paiement */}
      {upgradeIntent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <h3 className="text-xl font-bold text-white mb-2">Moyen de paiement</h3>
            <p className="text-slate-400 text-sm mb-4">Choisissez comment vous souhaitez payer votre abonnement.</p>

            {/* Promo Code Section */}
            <div className="mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
              <label className="text-xs text-slate-400 font-bold mb-2 block uppercase tracking-wider">
                Code Promo (Optionnel)
              </label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  disabled={!!appliedPromo || verifyingPromo}
                  placeholder="ENTREZ LE CODE"
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
                {appliedPromo ? (
                  <button 
                    onClick={() => { setAppliedPromo(null); setPromoCode(''); }}
                    className="px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-bold rounded-lg transition-colors border border-red-500/20"
                  >
                    Retirer
                  </button>
                ) : (
                  <button 
                    onClick={handleVerifyPromo}
                    disabled={!promoCode.trim() || verifyingPromo}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    {verifyingPromo ? '...' : 'Appliquer'}
                  </button>
                )}
              </div>
              {promoError && <p className="text-xs text-red-400 mt-2">{promoError}</p>}
              
              {appliedPromo && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-green-400 font-bold">Réduction (-{appliedPromo.discount}%)</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-slate-500 line-through text-xs">{appliedPromo.originalPrice.toLocaleString('fr-FR')} HTG</span>
                    <span className="text-white font-bold">{appliedPromo.finalPrice.toLocaleString('fr-FR')} HTG</span>
                  </div>
                </div>
              )}
            </div>

            {actionError && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}
            
            <div className="space-y-3 mb-6">
              {(() => {
                const selectedPlan = plans.find(p => p.slug === upgradeIntent.planSlug);
                const finalPriceToPay = appliedPromo 
                  ? appliedPromo.finalPrice 
                  : (upgradeIntent.isYearly ? (selectedPlan?.price_htg || 0) * 0.8 * 12 : (selectedPlan?.price_htg || 0));
                
                const balance = data?.merchant?.available_balance || 0;
                const canPayWithBalance = balance >= finalPriceToPay;
                const providerConfig = data?.providerConfig;
                const moncashAvailable = providerConfig?.active_provider === 'bazik'
                  || providerConfig?.paym_moncash_web
                  || providerConfig?.paym_moncash_ussd;
                const natcashAvailable = providerConfig?.active_provider === 'bazik'
                  ? providerConfig?.sms_gateway_enabled
                  : providerConfig?.paym_natcash_web;

                if (finalPriceToPay === 0) {
                  return (
                    <button 
                      onClick={() => handleUpgrade(upgradeIntent.planSlug, upgradeIntent.isYearly ? 'yearly' : 'monthly', 'free')}
                      disabled={upgrading}
                      className="w-full p-4 flex items-center justify-center gap-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-2xl transition-colors text-center"
                    >
                      Activer gratuitement
                    </button>
                  );
                }

                return (
                  <>
                    <button 
                      onClick={() => handleUpgrade(upgradeIntent.planSlug, upgradeIntent.isYearly ? 'yearly' : 'monthly', 'balance')}
                      disabled={upgrading || !canPayWithBalance}
                      className="w-full p-4 flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="w-10 h-10 bg-emerald-500/20 text-emerald-500 rounded-xl flex items-center justify-center shrink-0">
                        <span className="font-black text-lg">HTG</span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold">Mon Solde ({balance.toLocaleString('fr-FR')} HTG)</h4>
                        <p className={canPayWithBalance ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>
                          {canPayWithBalance ? `Payer ${finalPriceToPay.toLocaleString('fr-FR')} HTG` : "Solde insuffisant"}
                        </p>
                      </div>
                    </button>

                    {moncashAvailable && <button
                      onClick={() => handleUpgrade(upgradeIntent.planSlug, upgradeIntent.isYearly ? 'yearly' : 'monthly', 'moncash')}
                      disabled={upgrading}
                      className="w-full p-4 flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold">MonCash</h4>
                        <p className="text-slate-400 text-xs">Paiement mobile instantané</p>
                      </div>
                    </button>}

                    {natcashAvailable && <button
                      onClick={() => handleUpgrade(upgradeIntent.planSlug, upgradeIntent.isYearly ? 'yearly' : 'monthly', 'natcash')}
                      disabled={upgrading}
                      className="w-full p-4 flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-colors text-left"
                    >
                      <div className="w-10 h-10 bg-blue-500/20 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
                        <span className="font-black text-sm">NC</span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold">NatCash</h4>
                        <p className="text-slate-400 text-xs">
                          {providerConfig?.active_provider === 'paym' ? 'Paiement mobile instantané' : 'Paiement par transfert'}
                        </p>
                      </div>
                    </button>}
                  </>
                );
              })()}
            </div>

            <button 
              onClick={() => {
                setUpgradeIntent(null);
                setAppliedPromo(null);
                setPromoCode('');
                setPromoError(null);
                setActionError(null);
              }}
              disabled={upgrading}
              className="w-full mt-3 py-3 rounded-xl border border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 text-sm"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Écran d'attente NatCash */}
      {natcashData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111827] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl relative text-center">
            <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="font-black text-xl">NC</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Paiement NatCash</h3>
            <p className="text-slate-400 text-sm mb-6">Pour finaliser votre abonnement, veuillez effectuer le transfert NatCash depuis votre téléphone :</p>
            
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8">
              <p className="text-slate-300 text-sm mb-4">Utilisez votre application NatCash ou faites <span className="font-bold text-white">*202#</span> pour transférer le montant au numéro <span className="font-bold text-white">40 03 56 64</span>.</p>
              <p className="text-slate-500 text-sm mb-2">Code de référence à inclure :</p>
              <div className="text-2xl sm:text-3xl font-black text-orange-400 tracking-wider break-words selection:bg-orange-500/30">
                {natcashData.referenceCode}
              </div>
              <p className="text-slate-500 text-sm mt-4">
                Votre plan sera automatiquement validé après le paiement. Ne fermez pas cette page.
              </p>
            </div>

            {!showTranscodeInput ? (
              <button 
                onClick={() => setShowTranscodeInput(true)}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-colors"
              >
                Fermer (J'ai payé)
              </button>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="text-left">
                  <label className="text-sm font-bold text-white mb-1 block">TransCode (reçu par SMS)</label>
                  <input 
                    type="text" 
                    value={transCode}
                    onChange={(e) => setTransCode(e.target.value)}
                    placeholder="ex: 26062891687375"
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
                  />
                  <p className="text-xs text-slate-500 mt-2">Vérification manuelle si le SMS tarde à être détecté.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => {
                      setNatcashData(null);
                      window.location.reload();
                    }}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-300 font-bold rounded-xl transition-colors"
                  >
                    Fermer
                  </button>
                  <button 
                    onClick={handleVerifyTransCode}
                    disabled={verifyingTransCode || !transCode.trim()}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    {verifyingTransCode ? 'Vérification...' : 'Vérifier'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
