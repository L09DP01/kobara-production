import Link from "next/link";

import { PartnerLoginForm } from "@/components/partners/partner-login-form";
import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

export default function DeveloperLoginPage() {
  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] text-[#10131D]">
      <PublicHeader />
      <section className="mx-auto my-16 w-[calc(100%-2.5rem)] max-w-md rounded-md border border-[#DDD7D3] bg-white p-7">
        <Link href="/developer" className="text-sm text-[#5C5E66]">← Programme Developer</Link>
        <h1 className="mt-8 text-3xl font-black">Connexion Developer</h1>
        <p className="mb-8 mt-2 text-[#5C5E66]">Gérez vos clients, intégrations et commissions.</p>
        <PartnerLoginForm role="developer" />
        <p className="mt-6 text-center text-sm text-[#5C5E66]">Pas encore inscrit ? <Link href="/developer/register" className="font-bold text-[#F45D2C]">Créer un compte</Link></p>
      </section>
      <Footer />
    </main>
  );
}
