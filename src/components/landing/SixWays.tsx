"use client";

import { motion } from "framer-motion";
import { ShoppingCart, Link2, QrCode, Smartphone, FileText, Code2 } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

export function SixWays() {
  const { t } = useTranslation();

  const ways = [
    {
      title: t("home.way1Title"),
      description: t("home.way1Desc"),
      icon: ShoppingCart,
    },
    {
      title: t("home.way2Title"),
      description: t("home.way2Desc"),
      icon: Link2,
    },
    {
      title: t("home.way3Title"),
      description: t("home.way3Desc"),
      icon: QrCode,
    },
    {
      title: t("home.way4Title"),
      description: t("home.way4Desc"),
      icon: Smartphone,
    },
    {
      title: t("home.way5Title"),
      description: t("home.way5Desc"),
      icon: FileText,
    },
    {
      title: t("home.way6Title"),
      description: t("home.way6Desc"),
      icon: Code2,
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[#020B14] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-sm font-bold text-[#FF4A1C] tracking-widest uppercase mb-4">
            {t("home.waysPreTitle")}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {t("home.waysTitle")} <span className="text-[#FF4A1C]">{t("home.waysTitleHighlight")}</span> {t("home.waysTitleEnd")}
          </h2>
          <p className="text-[#AAB3C2] text-lg">
            {t("home.waysSubtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ways.map((way, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
              className="group relative overflow-hidden rounded-lg border border-[#1E2A38] bg-[#07111F] p-8 transition-all hover:border-[#FF4A1C]/50"
            >
              {/* Background Glow on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#FF4A1C]/0 via-transparent to-transparent group-hover:from-[#FF4A1C]/10 transition-colors duration-500" />
              
              <div className="relative z-10">
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-md border border-[#1E2A38] bg-[#020B14] shadow-lg transition-colors group-hover:border-[#FF4A1C]">
                  <way.icon className="w-7 h-7 text-[#FF4A1C]" />
                </div>
                
                <h3 className="text-xl font-bold text-white mb-3">{way.title}</h3>
                <p className="text-[#AAB3C2] leading-relaxed">
                  {way.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
