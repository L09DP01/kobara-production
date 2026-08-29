import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import Link from "next/link";
import { CreatePaymentLinkForm } from "./create-form-client";

export default async function CreatePaymentLinkPage() {
  await getCurrentUserAndMerchant();

  return (
    <div className="max-w-[800px] mx-auto w-full space-y-6 sm:space-y-8 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mb-2">
            <Link href="/payment-links" className="hover:text-white transition-colors">Liens de Paiement</Link>
            <span className="material-symbols-outlined text-[14px] sm:text-[16px]">chevron_right</span>
            <span className="text-white font-bold">Créer</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Créer un lien de paiement</h1>
        </div>
      </div>

      <div className="bg-white/5 rounded-3xl border border-white/10 shadow-sm p-4 sm:p-6">
        <CreatePaymentLinkForm />
      </div>
    </div>
  );
}
