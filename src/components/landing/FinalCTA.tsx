"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn, getDashboardUrl } from "@/lib/utils";
import { useTranslation } from "@/context/LanguageContext";

export function FinalCTA() {
  const { t, language } = useTranslation();

  return (
    <section className="py-32 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-kobara-red/10 via-kobara-orange/10 to-blue-500/10 blur-[120px] rounded-full" />
      
      <div className="max-w-[1280px] mx-auto px-5 md:px-10 relative z-10">
        <div className="glass rounded-[48px] p-8 md:p-20 text-center border-white shadow-2xl bg-white/40 backdrop-blur-2xl">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto space-y-10"
          >
            <h2 className="text-4xl md:text-6xl font-black text-kobara-primary tracking-tighter leading-[1.05]">
              {t("home.ctaTitle")}
            </h2>
            <p className="text-xl text-kobara-secondary font-medium leading-relaxed">
              {t("home.ctaDesc")}
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link 
                href={getDashboardUrl('/register')} 
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "h-14 md:h-16 px-8 md:px-12 rounded-2xl bg-kobara-primary hover:bg-slate-900 text-white text-lg md:text-xl font-bold shadow-xl shadow-kobara-primary/10 transition-all hover:scale-105 active:scale-95 flex items-center gap-3"
                )}
              >
                {t("home.ctaBtn")}
                <ArrowRight className="w-6 h-6" />
              </Link>
              <Link 
                href="/contact"
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-14 md:h-16 px-8 md:px-12 rounded-2xl border-white bg-white/40 backdrop-blur-sm text-kobara-primary text-lg md:text-xl font-bold transition-all hover:bg-white w-full sm:w-auto"
                )}
              >
                {language === "fr" ? "Contacter le service commercial" : "Contact Sales"}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

