import { getKycStatus } from "./actions";
import Link from "next/link";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { redirect } from "next/navigation";
import { DiditVerificationButton } from "@/components/kyc/DiditVerificationButton";
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";

export default async function KycPage() {
  const { merchant, userRole } = await getCurrentUserAndMerchant();
  if (!merchant) redirect('/login');

  if (userRole !== 'owner') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="bg-white/5 border border-white/10 p-8 rounded-2xl text-center max-w-md">
          <ShieldCheck className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-slate-400">Seul le propriétaire du compte peut accéder à la page de vérification d'identité.</p>
        </div>
      </div>
    );
  }

  const profile = await getKycStatus();
  const kycStatus = merchant.kyc_status || profile?.status || 'not_started';

  const isApproved = kycStatus === 'approved';
  const isInReview = kycStatus === 'in_review' || kycStatus === 'pending';
  const isRejected = kycStatus === 'rejected';
  const isNotStarted = kycStatus === 'not_started';

  return (
    <div className="max-w-[800px] w-full mx-auto pb-12 space-y-8">
      {/* Header Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-start justify-between gap-4 mb-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Vérification Certifiée & Sécurisée
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Vérification d'Identité
            </h1>
            <p className="text-sm text-slate-400 mt-2 max-w-xl leading-relaxed">
              Pour activer les paiements réels, vos retraits et le plan gratuit, complétez la vérification sécurisée de votre identité.
            </p>
          </div>

          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 items-center justify-center text-orange-400 flex-shrink-0">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>

        {/* Status Section */}
        {isApproved && (
          <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-green-500/20 mx-auto flex items-center justify-center mb-4 text-green-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Compte Vérifié avec Succès !</h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
              Votre identité a été confirmée. Vos encaissements réels et retraits MonCash / NatCash / Zelle sont pleinement opérationnels.
            </p>
            <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-5 py-2 rounded-full text-xs font-bold border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Mode Production & Retraits Activés
            </div>
          </div>
        )}

        {isInReview && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 mx-auto flex items-center justify-center mb-4 text-amber-400">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-xl font-bold text-amber-400 mb-2">Vérification en Cours d'Examen</h3>
            <p className="text-sm text-slate-300 max-w-md mx-auto mb-6 leading-relaxed">
              Votre dossier d'identité a été soumis avec succès. Notre équipe de conformité finalise son analyse.
            </p>
            <div className="inline-flex items-center gap-2 bg-amber-500/20 text-amber-300 px-4 py-2 rounded-full text-xs font-semibold border border-amber-500/30 mb-6">
              <Clock className="w-4 h-4" />
              Délai moyen de traitement : quelques minutes à 24h
            </div>
            <div>
              <DiditVerificationButton buttonText="Mettre à jour ou resoumettre mon dossier" variant="secondary" className="max-w-xs mx-auto" />
            </div>
          </div>
        )}

        {(isNotStarted || isRejected) && (
          <div className="space-y-6">
            <div className="bg-slate-950/60 border border-slate-800 p-6 rounded-xl space-y-4">
              <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-400" />
                Déroulement de la vérification (Moins de 2 minutes) :
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-xs mb-3">1</div>
                  <h4 className="text-sm font-semibold text-white mb-1">Pièce d'identité</h4>
                  <p className="text-xs text-slate-400">Passeport, Carte Nationale d'Identité ou Permis de conduire valide.</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-xs mb-3">2</div>
                  <h4 className="text-sm font-semibold text-white mb-1">Vérification faciale</h4>
                  <p className="text-xs text-slate-400">Un selfie rapide avec détection biométrique du vivant (Liveness).</p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center font-bold text-xs mb-3">3</div>
                  <h4 className="text-sm font-semibold text-white mb-1">Activation immédiate</h4>
                  <p className="text-xs text-slate-400">Validation instantanée et déblocage de vos fonctionnalités.</p>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <DiditVerificationButton buttonText="Lancer la vérification d'identité" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
