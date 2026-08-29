"use client";

import { motion } from "framer-motion";
import { Star, ShieldCheck, Quote } from "lucide-react";
import { useTranslation } from "@/context/LanguageContext";

interface Review {
  name: string;
  role: { fr: string; en: string };
  company: string;
  content: { fr: string; en: string };
  rating: number;
  avatarInitials: string;
}

const REVIEWS_DATA: Review[] = [
  {
    name: "Chancy Jean-Baptiste",
    role: { fr: "Fondateur & Dev Lead", en: "Founder & Dev Lead" },
    company: "Ayiti E-commerce",
    content: {
      fr: "Kobara a totalement transformé notre manière d'accepter MonCash. L'intégration s'est faite en quelques minutes avec le SDK Node, et les webhooks sont incroyablement stables.",
      en: "Kobara completely transformed how we accept MonCash. Integration took minutes with the Node SDK, and the webhooks are incredibly stable."
    },
    rating: 5,
    avatarInitials: "CJ"
  },
  {
    name: "Marissa Clerge",
    role: { fr: "Co-fondatrice & Directrice Financière", en: "Co-founder & CFO" },
    company: "Kado Delivery",
    content: {
      fr: "Le dashboard Kobara nous donne une visibilité parfaite sur nos flux de paiement. La gestion automatique des frais et les retraits ultra-rapides facilitent grandement notre gestion financière.",
      en: "The Kobara dashboard gives us perfect visibility into our payment flows. Automatic fee handling and ultra-fast withdrawals make our financial management so much easier."
    },
    rating: 5,
    avatarInitials: "MC"
  },
  {
    name: "Kervens Pierre",
    role: { fr: "Ingénieur Full-Stack", en: "Full-Stack Engineer" },
    company: "Studio Média",
    content: {
      fr: "En tant que développeur, j'apprécie énormément la robustesse de l'API de Kobara. Le support MFA, la rotation des clés API, et la documentation interactive sont au niveau des standards de Stripe.",
      en: "As a developer, I really appreciate the robustness of Kobara's API. The MFA support, API key rotation, and interactive docs are up to Stripe's high standards."
    },
    rating: 5,
    avatarInitials: "KP"
  }
];

export function Reviews() {
  const { language } = useTranslation();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } }
  };

  return (
    <section className="py-24 relative overflow-hidden bg-slate-50/50">
      {/* Background patterns */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-rose-100/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-orange-100/30 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-[1280px] mx-auto px-5 sm:px-10 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-rose-50 border border-rose-100 text-sm font-bold text-kobara-red">
            <Star className="w-4 h-4 fill-kobara-red" />
            {language === "fr" ? "Retours d'expérience" : "Customer Success Stories"}
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-kobara-primary tracking-tighter leading-tight">
            {language === "fr" 
              ? "Recommandé par les leaders de l'économie digitale en Haïti" 
              : "Trusted by the leaders of Haiti's digital economy"}
          </h2>
          <p className="text-base sm:text-lg text-kobara-secondary font-medium leading-relaxed">
            {language === "fr" 
              ? "Découvrez pourquoi les développeurs et entrepreneurs haïtiens choisissent l'infrastructure de Kobara pour propulser leur croissance." 
              : "Discover why Haitian developers and entrepreneurs choose Kobara's infrastructure to power their growth."}
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8"
        >
          {REVIEWS_DATA.map((review, i) => (
            <motion.div
              key={i}
              variants={cardVariants}
              whileHover={{ y: -6, boxShadow: "0 20px 40px rgba(0,0,0,0.04)" }}
              className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-6 sm:p-8 shadow-sm flex flex-col justify-between relative transition-all duration-350"
            >
              {/* Quote icon overlay */}
              <div className="absolute top-6 right-8 text-slate-100 pointer-events-none">
                <Quote className="w-12 h-12 rotate-180 fill-slate-50" />
              </div>

              <div className="space-y-6 relative z-10">
                {/* Rating */}
                <div className="flex gap-1">
                  {[...Array(review.rating)].map((_, idx) => (
                    <Star key={idx} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>

                {/* Review Text */}
                <p className="text-sm sm:text-[16px] text-slate-700 leading-relaxed font-medium italic">
                  "{language === "fr" ? review.content.fr : review.content.en}"
                </p>
              </div>

              {/* User Bio */}
              <div className="flex items-center gap-3 sm:gap-4 pt-6 sm:pt-8 border-t border-slate-100 mt-6 sm:mt-8 relative z-10">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-kobara-orange/20 to-kobara-red/20 text-kobara-primary flex items-center justify-center font-bold text-base sm:text-lg border border-white shrink-0 shadow-sm">
                  {review.avatarInitials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-bold text-kobara-primary text-[14px] sm:text-[15px] truncate">{review.name}</h4>
                    <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  </div>
                  <p className="text-xs text-kobara-secondary font-medium truncate mt-0.5">
                    {language === "fr" ? review.role.fr : review.role.en} @ <span className="font-bold text-kobara-primary">{review.company}</span>
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
