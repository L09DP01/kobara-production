import { SupportClient } from "./support-client";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";

export default async function SupportPage() {
  const { merchant, user } = await getCurrentUserAndMerchant();

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-8 pb-16">
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-white text-2xl tracking-tight">Support Client</h1>
        <p className="font-body-sm text-slate-400">
          Besoin d'aide ? Notre équipe est là pour vous assister. Envoyez-nous un message et nous vous répondrons dans les plus brefs délais.
        </p>
      </div>

      <SupportClient merchant={merchant} user={user} />
    </div>
  );
}
