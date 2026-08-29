"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/context/LanguageContext";

export function CTA() {
  const { t } = useTranslation();
  return (
    <section className="py-10 md:py-16 relative overflow-hidden bg-[#020B14]">
      {/* Background Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-[#FF4A1C]/5 rounded-full blur-[80px] md:blur-[100px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1E2A38]/30 border border-[#1E2A38] text-sm text-[#AAB3C2] mb-8">
            <Sparkles className="w-4 h-4 text-[#FF4A1C]" />
            {t("home.devBadge")}
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 tracking-tight">
            {t("home.ctaTitle")}
          </h2>
          
          <p className="text-lg text-[#AAB3C2] mb-12 max-w-2xl mx-auto leading-relaxed">
            {t("home.ctaDesc")}
          </p>

          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-[#FF4A1C] hover:bg-[#FF2E14] text-white font-semibold text-lg transition-all shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] group"
          >
            {t("home.ctaBtn")}
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
