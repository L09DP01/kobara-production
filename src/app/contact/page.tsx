import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import { Mail, MessageCircle, MapPin, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Contact — Kobara",
  description: "Get in touch with the Kobara team. We're here to help.",
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
              Get in touch
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tighter leading-[1.05] mb-5">
              We&apos;d love to hear<br />
              <span className="text-[#FF4A1C]">from you.</span>
            </h1>
            <p className="text-lg text-[#AAB3C2] font-medium max-w-xl mx-auto leading-relaxed">
              Have a question, need support, or want to partner with Kobara? Reach out and we&apos;ll get back to you quickly.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-10">
            {/* Contact info */}
            <div className="space-y-6">
              {[
                { icon: Mail, label: "Email", value: "support@kobara.app", href: "mailto:support@kobara.app" },
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
                  Business Hours
                </h3>
                <p className="text-[#AAB3C2] font-medium leading-relaxed">
                  Monday – Friday: 8:00 AM – 6:00 PM (EST)<br />
                  Saturday: 9:00 AM – 1:00 PM (EST)<br />
                  Sunday: Closed
                </p>
              </div>
            </div>

            {/* Contact form */}
            <form className="bg-[#07111F] border border-[#1E2A38] rounded-[32px] p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden" action="mailto:support@kobara.app" method="get" encType="text/plain">
              {/* Subtle background glow */}
              <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#FF4A1C]/5 rounded-full blur-[80px] pointer-events-none" />

              <div className="grid sm:grid-cols-2 gap-5 relative z-10">
                <div>
                  <label className="block text-sm font-bold text-[#AAB3C2] mb-2">First name</label>
                  <input name="firstname" type="text" placeholder="Jean" className="w-full h-13 px-5 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white placeholder:text-[#1E2A38] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Last name</label>
                  <input name="lastname" type="text" placeholder="Pierre" className="w-full h-13 px-5 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white placeholder:text-[#1E2A38] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all" />
                </div>
              </div>
              <div className="relative z-10">
                <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Email address</label>
                <input name="email" type="email" placeholder="jean@example.com" className="w-full h-13 px-5 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white placeholder:text-[#1E2A38] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all" />
              </div>
              <div className="relative z-10">
                <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Subject</label>
                <select name="subject" className="w-full h-13 px-5 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all appearance-none">
                  <option value="" className="text-[#1E2A38]">Select a topic...</option>
                  <option value="support">Technical Support</option>
                  <option value="sales">Sales &amp; Pricing</option>
                  <option value="partnership">Partnership</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="relative z-10">
                <label className="block text-sm font-bold text-[#AAB3C2] mb-2">Message</label>
                <textarea name="body" rows={5} placeholder="Tell us how we can help..." className="w-full px-5 py-4 rounded-xl border border-[#1E2A38] bg-[#020B14] text-white placeholder:text-[#1E2A38] font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4A1C]/30 focus:border-[#FF4A1C] transition-all resize-none" />
              </div>
              <button type="submit" className="w-full h-14 rounded-xl bg-[#FF4A1C] hover:bg-[#FF2E14] text-white font-bold text-[16px] transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] relative z-10 mt-4">
                Send Message
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
