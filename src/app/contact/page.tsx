import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import { Mail, MessageCircle, MapPin, ArrowRight } from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact — Kobara",
  description: "Contactez l'équipe Kobara et suivez votre demande avec une référence de support.",
};

export default function ContactPage() {
  return (
    <main className="relative min-h-[100dvh] bg-[#020B14] selection:bg-[#FF4A1C] selection:text-white font-sans text-white">
      <FloatingBackground />
      <Navbar />

      <section className="pt-40 pb-24 relative">
        <div className="max-w-[1100px] mx-auto px-5 sm:px-10">
          {/* Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-sm font-bold text-[#FF4A1C] mb-6 shadow-[0_0_15px_rgba(255,74,28,0.2)]">
              Nous contacter
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tighter leading-[1.05] mb-5">
              Parlons de votre<br />
              <span className="text-[#FF4A1C]">demande.</span>
            </h1>
            <p className="text-lg text-[#AAB3C2] font-medium max-w-xl mx-auto leading-relaxed">
              Assistance, intégration ou partenariat : chaque message devient une demande suivie par notre équipe.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Contact info */}
            <div className="space-y-6">
              {[
                { icon: Mail, label: "Assistance", value: "support@kobara.app", href: "#contact-form" },
                { icon: MessageCircle, label: "WhatsApp", value: "+509 4003 5664", href: "tel:+50940035664" },
                { icon: MapPin, label: "Location", value: "Port-au-Prince, Haïti", href: "#" },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  className="flex items-center gap-5 p-6 bg-[#07111F] border border-[#1E2A38] rounded-2xl hover:border-[#AAB3C2]/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all group"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#020B14] border border-[#1E2A38] flex items-center justify-center text-[#FF4A1C] shrink-0 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(255,74,28,0.1)] group-hover:shadow-[0_0_20px_rgba(255,74,28,0.3)]">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm text-[#AAB3C2] font-semibold">{item.label}</div>
                    <div className="text-white font-bold text-lg">{item.value}</div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#AAB3C2] ml-auto opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </a>
              ))}

              <div className="p-8 bg-[#FF4A1C]/5 border border-[#FF4A1C]/20 rounded-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4A1C]/10 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2" />
                <h3 className="font-bold text-xl mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#FF4A1C] animate-pulse" />
                  Horaires
                </h3>
                <p className="text-[#AAB3C2] font-medium leading-relaxed">
                  Lundi – vendredi : 8 h – 18 h (EST)<br />
                  Samedi : 9 h – 13 h (EST)<br />
                  Dimanche : fermé
                </p>
              </div>
            </div>

            <div id="contact-form" className="scroll-mt-28">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
