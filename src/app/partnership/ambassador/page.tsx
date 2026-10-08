import { AmbassadorApplicationForm } from "@/components/partners/ambassador-application-form";
import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

export default function AmbassadorLanding() {
  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] text-[#10131D]">
      <PublicHeader />
      <section className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[.8fr_1.2fr]">
        <div>
          <p className="font-bold text-[#F45D2C]">PROGRAMME PRIVÉ</p>
          <h1 className="mt-4 text-4xl font-black">Devenir Ambassadeur Kobara</h1>
          <p className="mt-5 leading-7 text-[#5C5E66]">Présentez Kobara aux entreprises de votre réseau et suivez vos récompenses dans un espace dédié. Chaque demande est examinée et activée manuellement par l’administration.</p>
        </div>
        <AmbassadorApplicationForm />
      </section>
      <Footer />
    </main>
  );
}
