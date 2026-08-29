"use client";

import { motion } from "framer-motion";
import { Link2, ShieldCheck, Zap, Globe, BarChart3, Bell } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

export function Features() {
  const { t, language } = useTranslation();

  const features = [
    {
      title: t("home.featureLinksTitle"),
      description: t("home.featureLinksDesc"),
      icon: Link2,
      color: "text-rose-500",
      bg: "bg-rose-50"
    },
    {
      title: t("home.featureApiTitle"),
      description: t("home.featureApiDesc"),
      icon: ShieldCheck,
      color: "text-blue-500",
      bg: "bg-blue-50"
    },
    {
      title: language === "fr" ? "Webhooks en temps réel" : "Real-time Webhooks",
      description: language === "fr" 
        ? "Soyez averti instantanément lorsqu'un paiement est réussi. Automatisez le traitement de vos commandes."
        : "Get notified instantly when a payment is successful. Automate your order fulfillment.",
      icon: Zap,
      color: "text-orange-500",
      bg: "bg-orange-50"
    },
    {
      title: language === "fr" ? "Accès au marché" : "Market Access",
      description: language === "fr"
        ? "Touchez des millions d'utilisateurs MonCash en Haïti. Développez votre entreprise instantanément."
        : "Reach millions of MonCash users across Haiti. Expand your business instantly.",
      icon: Globe,
      color: "text-emerald-500",
      bg: "bg-emerald-50"
    },
    {
      title: language === "fr" ? "Analyses avancées" : "Advanced Analytics",
      description: language === "fr"
        ? "Suivez vos ventes, votre volume et votre croissance avec un tableau de bord intuitif."
        : "Track your sales, volume and growth with our beautiful and intuitive dashboard.",
      icon: BarChart3,
      color: "text-indigo-500",
      bg: "bg-indigo-50"
    },
    {
      title: language === "fr" ? "Notifications instantanées" : "Instant Notifications",
      description: language === "fr"
        ? "Restez informé grâce aux notifications push et par e-mail en temps réel pour chaque transaction."
        : "Stay updated with real-time push and email notifications for every transaction on your account.",
      icon: Bell,
      color: "text-amber-500",
      bg: "bg-amber-50"
    }
  ];

  return (
    <section className="py-24 relative">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10">
        <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-sm font-bold text-blue-600">
            {language === "fr" ? "Fonctionnalités puissantes" : "Powerful Features"}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-kobara-primary tracking-tighter">
            {t("home.featuresTitle")}
          </h2>
          <p className="text-lg text-kobara-secondary font-medium leading-relaxed">
            {t("home.featuresDesc")}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ y: 20, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass p-8 rounded-[32px] border-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <div className={`w-14 h-14 rounded-2xl ${feature.bg} flex items-center justify-center ${feature.color} mb-6 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-kobara-primary mb-3 tracking-tight">
                {feature.title}
              </h3>
              <p className="text-kobara-secondary font-medium leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

