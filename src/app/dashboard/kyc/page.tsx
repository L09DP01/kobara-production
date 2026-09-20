import { getKycStatus } from "./actions";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { redirect } from "next/navigation";
import { DiditVerificationButton } from "@/components/kyc/DiditVerificationButton";
import { ShieldCheck, CheckCircle2, Clock, Sparkles } from "lucide-react";

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
  const kycStatus = profile?.status === 'approved'
    ? 'approved'
    : merchant.kyc_status || profile?.status || 'not_started';

  const isApproved = kycStatus === 'approved';
  const isInReview = kycStatus === 'in_review' || kycStatus === 'pending';
  const isRejected = kycStatus === 'rejected';
  const isNotStarted = kycStatus === 'not_started';

  return (
    <div className="mx-auto w-full max-w-[760px] pb-6 sm:pb-12">
      {/* Header Card */}
      <div className="relative border-slate-800 bg-transparent sm:overflow-hidden sm:rounded-lg sm:border sm:bg-slate-900/80 sm:p-8 sm:shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4 sm:mb-6">
          <div className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-400 sm:gap-2 sm:px-3 sm:text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Vérification certifiée et sécurisée
            </div>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              Vérification d'Identité
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">
              Vérifiez votre identité pour débloquer les paiements réels et les fonctions du dashboard.
            </p>
          </div>

          <div className="hidden h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-orange-500/10 text-orange-400 sm:flex">
            <ShieldCheck className="w-8 h-8" />
          </div>
        </div>

        {/* Status Section */}
        {isApproved && (
          <div className="relative overflow-hidden rounded-lg border border-green-500/20 bg-green-500/10 p-5 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20 text-green-400 sm:h-16 sm:w-16">
              <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-green-400 sm:text-xl">Compte vérifié avec succès</h3>
            <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-slate-300 sm:mb-6">
              Votre identité a été confirmée. Vos encaissements réels et retraits MonCash / NatCash / Zelle sont pleinement opérationnels.
            </p>
            <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-300 px-5 py-2 rounded-full text-xs font-bold border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              Mode Production & Retraits Activés
            </div>
          </div>
        )}

        {isInReview && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-5 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 sm:h-16 sm:w-16">
              <Clock className="h-7 w-7 animate-pulse sm:h-8 sm:w-8" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-amber-400 sm:text-xl">Vérification en cours d'examen</h3>
            <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-slate-300 sm:mb-6">
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
          <div className="space-y-4 sm:space-y-6">
            <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-4 py-3 sm:p-6">
              <h3 className="flex min-h-10 items-center gap-2 text-sm font-bold text-white sm:mb-4 sm:text-base">
                <ShieldCheck className="h-5 w-5 shrink-0 text-orange-400" />
                <span>3 étapes, moins de 2 minutes</span>
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 sm:gap-4">
                <div className="flex items-start gap-3 border-b border-slate-800 py-3 sm:block sm:rounded-lg sm:border sm:bg-slate-900 sm:p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-xs font-bold text-orange-400 sm:mb-3">1</div>
                  <div className="min-w-0">
                    <h4 className="mb-1 text-sm font-semibold text-white">Pièce d'identité</h4>
                    <p className="text-xs leading-5 text-slate-400">Passeport, carte d'identité ou permis valide.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-b border-slate-800 py-3 sm:block sm:rounded-lg sm:border sm:bg-slate-900 sm:p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-xs font-bold text-orange-400 sm:mb-3">2</div>
                  <div className="min-w-0">
                    <h4 className="mb-1 text-sm font-semibold text-white">Vérification faciale</h4>
                    <p className="text-xs leading-5 text-slate-400">Un selfie rapide avec détection du vivant.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 py-3 sm:block sm:rounded-lg sm:border sm:border-slate-800 sm:bg-slate-900 sm:p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-500/10 text-xs font-bold text-orange-400 sm:mb-3">3</div>
                  <div className="min-w-0">
                    <h4 className="mb-1 text-sm font-semibold text-white">Activation</h4>
                    <p className="text-xs leading-5 text-slate-400">Déblocage des fonctionnalités après validation.</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <DiditVerificationButton buttonText="Lancer la vérification d'identité" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
