"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/context/LanguageContext";

export function PayButton() {
  const { t } = useTranslation();
  const benefits = [
    t("home.payButtonBenefit1") || "Facile à intégrer",
    t("home.payButtonBenefit2") || "Transactions sécurisées",
    t("home.payButtonBenefit3") || "Compatible avec tous les appareils",
  ];

  return (
    <section className="py-16 md:py-24 bg-[#020B14] overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Column - Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ duration: 0.8 }}
            className="max-w-lg"
          >
            <p className="text-sm font-bold text-[#FF4A1C] tracking-widest uppercase mb-4">
              {t("home.payButtonLabel") || "BOUTON DE PAIEMENT"}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              {t("home.payButtonTitle1") || "Un bouton sur"} <span className="text-[#FF4A1C]">{t("home.payButtonTitle2") || "votre site."}</span>
            </h2>
            <p className="text-[#AAB3C2] text-lg mb-8 leading-relaxed">
              {t("home.payButtonDesc") || "Ajoutez le bouton Kobara à votre site en quelques minutes et commencez à accepter des paiements."}
            </p>
            
            <div className="space-y-4 mb-10">
              {benefits.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white font-medium">
                  <CheckCircle2 className="w-5 h-5 text-[#FF4A1C]" />
                  {item}
                </div>
              ))}
            </div>

            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#FF4A1C] hover:bg-[#FF2E14] text-white font-semibold transition-all shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)]"
            >
              {t("home.payButtonCta") || "Ajouter le bouton Kobara"}
              <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                &rarr;
              </motion.span>
            </Link>
          </motion.div>

          {/* Right Column - Visual Mockup (Visible & Responsive) */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px" }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="block relative w-full max-w-full min-w-0"
          >
            {/* Main Mockup Card */}
            <div className="relative z-20 flex w-full flex-col overflow-hidden rounded-lg border border-[#1E2A38] bg-[#07111F] p-0 shadow-2xl">
              
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#1E2A38] bg-[#020B14] flex justify-between items-center">
                <span className="truncate font-medium text-white">{t("home.checkoutLabel") || "Checkout"}</span>
                <span className="text-[#AAB3C2] text-sm flex items-center gap-1 shrink-0">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  {t("home.secureLabel") || "Sécurisé"}
                </span>
              </div>

              {/* Product Layout */}
              <div className="p-5 md:p-8 flex flex-col sm:flex-row gap-5 md:gap-6">
                
                {/* Realistic Image Placeholder */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0 rounded-xl bg-white border border-[#1E2A38] flex items-center justify-center overflow-hidden shrink-0 shadow-inner relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="/images/product_icon.jpg" 
                    alt="Premium Product" 
                    className="w-full h-full object-cover mix-blend-multiply"
                  />
                </div>
                
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 truncate sm:whitespace-normal break-words">Premium Wireless Headphones</h3>
                    <p className="text-[#AAB3C2] text-sm mb-4 truncate sm:whitespace-normal">Noise-cancelling, over-ear</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-[#AAB3C2]">
                        <span>Subtotal</span>
                        <span>2,000 HTG</span>
                      </div>
                      <div className="flex justify-between text-[#AAB3C2]">
                        <span>Tax (TCA)</span>
                        <span>500 HTG</span>
                      </div>
                      <div className="w-full h-px bg-[#1E2A38] my-2" />
                      <div className="flex justify-between text-white font-bold text-lg">
                        <span>Total</span>
                        <span>2,500 HTG</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pay Button Target */}
                  <button className="mt-6 w-full px-4 md:px-6 py-3 md:py-4 rounded-xl bg-[#020B14] border border-[#1E2A38] hover:border-[#FF4A1C] text-white font-bold flex items-center justify-center gap-2 md:gap-3 shadow-lg hover:shadow-[0_0_15px_rgba(255,74,28,0.2)] transition-all group relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF4A1C]/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    {/* Kobara Logo */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Icone.png" alt="Kobara" className="w-5 h-5 md:w-6 md:h-6 object-contain relative z-10" />
                    <span className="relative z-10 text-sm md:text-base">Pay with Kobara</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Code Snippet Card */}
            <motion.div 
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative z-30 -mt-6 md:-mt-8 mx-auto w-[95%] md:w-[85%] bg-[#020B14] rounded-xl border border-[#1E2A38] p-4 md:p-5 shadow-2xl backdrop-blur-xl max-w-full overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex gap-1.5 items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF4A1C]" />
                  <span className="text-xs text-[#AAB3C2] font-mono ml-2">checkout.html</span>
                </div>
                <Copy className="w-4 h-4 text-[#AAB3C2] hover:text-white cursor-pointer" />
              </div>
              <pre className="text-[11px] md:text-[13px] leading-relaxed font-mono text-gray-300 overflow-x-auto pb-2 w-full">
<span className="text-blue-400">&lt;script</span> <span className="text-yellow-300">src=</span><span className="text-green-400">&quot;https://js.kobara.app/v1&quot;</span><span className="text-blue-400">&gt;&lt;/script&gt;</span>
<br />
<span className="text-blue-400">&lt;kobara-pay</span>
  <span className="text-yellow-300">amount=</span><span className="text-green-400">&quot;2500&quot;</span>
  <span className="text-yellow-300">currency=</span><span className="text-green-400">&quot;HTG&quot;</span>
  <span className="text-yellow-300">merchant=</span><span className="text-green-400">&quot;pk_live_xxxx&quot;</span><span className="text-blue-400">&gt;</span>
<span className="text-blue-400">&lt;/kobara-pay&gt;</span>
              </pre>
            </motion.div>

            {/* Animated Arrow Connector */}
            <svg className="absolute right-[-20px] top-[50%] w-20 h-40 hidden lg:block z-10" viewBox="0 0 100 150" fill="none">
              <motion.path 
                d="M 10,120 C 80,120 80,20 10,20" 
                stroke="#FF4A1C" 
                strokeWidth="2" 
                strokeDasharray="4 4"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.5, delay: 0.5 }}
              />
              <motion.polygon 
                points="10,15 5,20 10,25 15,20" 
                fill="#FF4A1C"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 2 }}
              />
            </svg>

          </motion.div>

        </div>
      </div>
    </section>
  );
}
