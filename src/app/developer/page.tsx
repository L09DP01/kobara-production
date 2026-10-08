import { ArrowRight, Code2, KeyRound, Users } from "lucide-react";
import Link from "next/link";

import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

export default function DeveloperLanding() {
  const benefits = [
    [Users, "Clients connectés", "Un suivi clair de chaque marchand."],
    [KeyRound, "Accès contrôlés", "Les retraits exigent toujours l’accord du marchand."],
    [Code2, "API Live", "Passez automatiquement en Live après le premier paiement admissible."],
  ] as const;

  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] text-[#10131D]">
      <PublicHeader />
      <section className="mx-auto max-w-6xl px-5 py-20">
        <p className="font-bold text-[#F45D2C]">PROGRAMME DEVELOPER</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-black sm:text-6xl">Intégrez Kobara pour vos clients et développez votre activité.</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-[#5C5E66]">Invitez des marchands, gérez leurs intégrations avec des accès limités et suivez vos commissions depuis un espace dédié.</p>
        <Link href="/developer/register" className="mt-8 inline-flex items-center gap-2 rounded-md bg-[#F45D2C] px-6 py-3 font-bold text-white">
          Rejoindre le programme <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {benefits.map(([Icon, title, description]) => (
            <article key={title} className="rounded-md border border-[#DDD7D3] bg-white p-6">
              <Icon className="h-6 w-6 text-[#F45D2C]" />
              <h2 className="mt-5 font-bold">{title}</h2>
              <p className="mt-2 text-sm text-[#5C5E66]">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
