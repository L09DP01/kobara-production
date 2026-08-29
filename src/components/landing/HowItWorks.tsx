"use client";

import { motion } from "framer-motion";
import { User, Server, ShieldCheck, Smartphone, Database, Layout } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { id: 1, label: t("home.step1"), icon: User, desc: t("home.step1Desc") },
    { id: 2, label: t("home.step2"), icon: Server, desc: t("home.step2Desc") },
    { id: 3, label: t("home.step3"), icon: ShieldCheck, desc: t("home.step3Desc") },
    { id: 4, label: t("home.step4"), icon: Smartphone, desc: t("home.step4Desc") },
    { id: 5, label: t("home.step5"), icon: Database, desc: t("home.step5Desc") },
    { id: 6, label: t("home.step6"), icon: Layout, desc: t("home.step6Desc") },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#07111F] relative overflow-hidden border-y border-[#1E2A38]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {t("home.howTitle")}
          </h2>
          <p className="text-[#AAB3C2] text-lg">
            {t("home.howSubtitle")}
          </p>
        </div>

        {/* Horizontal Flow Desktop / Vertical Flow Mobile */}
        <div className="relative flex flex-col lg:flex-row justify-between items-center lg:items-start gap-12 lg:gap-4">
          
          {/* Animated Connecting Line (Desktop) */}
          <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-[2px] bg-[#1E2A38] -z-10">
            <motion.div 
              className="h-full bg-gradient-to-r from-transparent via-[#FF4A1C] to-transparent"
              initial={{ x: "-100%" }}
              whileInView={{ x: "100%" }}
              viewport={{ once: true }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            />
          </div>

          {/* Animated Connecting Line (Mobile) */}
          <div className="block lg:hidden absolute top-[10%] bottom-[10%] left-1/2 -translate-x-1/2 w-[2px] bg-[#1E2A38] -z-10">
            <motion.div 
              className="w-full bg-gradient-to-b from-transparent via-[#FF4A1C] to-transparent h-1/3"
              initial={{ y: "-100%" }}
              whileInView={{ y: "300%" }}
              viewport={{ once: true }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            />
          </div>

          {steps.map((step, index) => (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className="flex flex-col items-center text-center max-w-[200px] lg:max-w-[150px] relative bg-[#07111F] p-4 rounded-xl lg:p-0 lg:bg-transparent"
            >
              <div className="w-16 h-16 rounded-2xl bg-[#020B14] border-2 border-[#1E2A38] flex items-center justify-center mb-6 relative group">
                <motion.div 
                  className="absolute inset-0 rounded-2xl bg-[#FF4A1C]/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
                <step.icon className="w-8 h-8 text-[#FF4A1C] relative z-10" />
                <div className="absolute -top-3 -right-3 w-6 h-6 rounded-full bg-[#1E2A38] text-xs font-bold text-white flex items-center justify-center border border-[#07111F]">
                  {step.id}
                </div>
              </div>
              <h4 className="text-white font-bold mb-2 text-sm">{step.label}</h4>
              <p className="text-[#AAB3C2] text-xs">{step.desc}</p>
            </motion.div>
          ))}
          
        </div>

      </div>
    </section>
  );
}
