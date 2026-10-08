import Link from "next/link";

import { DeveloperRegisterForm } from "@/components/partners/developer-register-form";
import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

export default function DeveloperRegisterPage() {
  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] text-[#10131D]">
      <PublicHeader />
      <section className="mx-auto max-w-2xl px-5 py-14">
        <Link href="/developer" className="text-sm text-[#5C5E66]">← Programme Developer</Link>
        <h1 className="mt-8 text-3xl font-black">Créer un profil Developer</h1>
        <p className="mb-8 mt-2 text-[#5C5E66]">Vous pouvez utiliser votre compte Kobara existant. Votre demande sera examinée avant activation.</p>
        <DeveloperRegisterForm />
      </section>
      <Footer />
    </main>
  );
}
