import { Clock3, Mail, MapPin, MessageCircle, ShieldCheck } from "lucide-react";

import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact — Kobara",
  description: "Contactez l’équipe Kobara et suivez votre demande avec une référence de support.",
};

const contactItems = [
  { icon: Mail, label: "Assistance", value: "support@kobara.app", href: "mailto:support@kobara.app" },
  { icon: MessageCircle, label: "Téléphone et WhatsApp", value: "+509 4003 5664", href: "tel:+50940035664" },
  { icon: MapPin, label: "Localisation", value: "Port-au-Prince, Haïti", href: null },
];

export default function ContactPage() {
  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] font-sans text-[#10131D] selection:bg-[#F45D2C] selection:text-white">
      <PublicHeader />

      <section className="border-b border-[#DDD7D3] py-10 sm:py-14">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <p className="text-sm font-bold text-[#F45D2C]">Contact Kobara</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight text-[#10131D] sm:text-4xl">Parlez directement à la bonne équipe.</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#5C5E66]">Assistance, intégration, tarification ou partenariat : décrivez votre besoin et conservez la référence fournie pour suivre votre demande.</p>

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div>
              <div className="divide-y divide-[#DDD7D3] border-y border-[#DDD7D3]">
                {contactItems.map(({ icon: Icon, label, value, href }) => {
                  const content = (
                    <>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF1E9] text-[#F45D2C]"><Icon className="h-5 w-5" /></span>
                      <span><span className="block text-xs font-bold text-[#8A6960]">{label}</span><strong className="mt-1 block text-sm text-[#10131D]">{value}</strong></span>
                    </>
                  );
                  return href ? <a key={label} href={href} className="flex min-h-20 items-center gap-4 py-4 transition-colors hover:text-[#F45D2C]">{content}</a> : <div key={label} className="flex min-h-20 items-center gap-4 py-4">{content}</div>;
                })}
              </div>

              <div className="mt-8 border-b border-[#DDD7D3] pb-8">
                <div className="flex items-center gap-3"><Clock3 className="h-5 w-5 text-[#F45D2C]" /><h2 className="font-extrabold text-[#10131D]">Horaires</h2></div>
                <p className="mt-3 text-sm leading-6 text-[#5C5E66]">Lundi au vendredi : 8 h – 18 h (EST)<br />Samedi : 9 h – 13 h (EST)<br />Dimanche : fermé</p>
              </div>

              <div className="mt-8 flex gap-3 text-sm leading-6 text-[#5C5E66]">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#39715B]" />
                <p>Ne transmettez jamais votre mot de passe, votre clé API secrète ou des données bancaires dans ce formulaire.</p>
              </div>
            </div>

            <div id="contact-form" className="scroll-mt-24"><ContactForm /></div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
