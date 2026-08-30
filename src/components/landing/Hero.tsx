"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  CheckCircle2,
  Code2,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { useTranslation } from "@/context/LanguageContext";

function ProductPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
      className="relative mx-auto w-full max-w-[650px] lg:mx-0"
      aria-label="Aperçu du checkout et du tableau de bord Kobara"
    >
      <div className="overflow-hidden rounded-lg border border-[#26384B] bg-[#091522] shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
        <div className="flex h-11 items-center justify-between border-b border-[#26384B] bg-[#0D1A29] px-4">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5A2A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E6B84A]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#29C889]" />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#AFC0D2]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#29C889]" />
            pay.kobara.app
          </div>
        </div>

        <div className="grid min-h-[390px] md:grid-cols-[0.9fr_1.1fr]">
          <div className="border-b border-[#26384B] bg-[#0B1726] p-5 md:border-b-0 md:border-r md:p-7">
            <div className="mb-8 flex items-center gap-2.5">
              <Image src="/Icone.png" alt="" width={28} height={28} className="h-7 w-7 rounded-md" />
              <span className="font-bold text-white">Kobara Checkout</span>
            </div>

            <p className="text-xs font-semibold uppercase text-[#7F95AC]">Montant à payer</p>
            <p className="mt-2 text-3xl font-extrabold text-white">2 500 <span className="text-base text-[#FF6A35]">HTG</span></p>

            <div className="mt-7 space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[#31445A] bg-[#111F30] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#FF6A35]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF6A35]" />
                  </span>
                  <span className="text-sm font-semibold text-white">MonCash</span>
                </div>
                <Image src="/moncash.png" alt="MonCash" width={34} height={24} className="h-6 object-contain" style={{ width: "auto" }} />
              </div>
              <div className="flex items-center justify-between rounded-md border border-[#26384B] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="h-5 w-5 rounded-full border border-[#62778E]" />
                  <span className="text-sm font-semibold text-white">NatCash</span>
                </div>
                <Image src="/natcash.png" alt="NatCash" width={34} height={24} className="h-6 object-contain" style={{ width: "auto" }} />
              </div>
            </div>

            <div className="mt-5 flex h-11 items-center justify-center gap-2 rounded-md bg-[#FF5A2A] text-sm font-bold text-white">
              Payer maintenant <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          <div className="hidden bg-[#07111D] p-5 md:block md:p-7">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#7F95AC]">{"Activité aujourd'hui"}</p>
                <p className="mt-1 text-lg font-bold text-white">Paiements en direct</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[#12362E] px-2.5 py-1 text-[11px] font-bold text-[#4EE3A8]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#4EE3A8]" /> En ligne
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-[#26384B] bg-[#0D1A29] p-4">
                <WalletCards className="h-5 w-5 text-[#FF6A35]" />
                <p className="mt-4 text-xs text-[#8FA3B8]">Total encaissé</p>
                <p className="mt-1 text-xl font-bold text-white">18 450 HTG</p>
              </div>
              <div className="rounded-md border border-[#26384B] bg-[#0D1A29] p-4">
                <Activity className="h-5 w-5 text-[#45A2FF]" />
                <p className="mt-4 text-xs text-[#8FA3B8]">Taux de succès</p>
                <p className="mt-1 text-xl font-bold text-white">98,7 %</p>
              </div>
            </div>

            <div className="mt-3 rounded-md border border-[#26384B] bg-[#0D1A29] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold text-[#AFC0D2]">Derniers paiements</span>
                <Code2 className="h-4 w-4 text-[#71869C]" />
              </div>
              {[
                ["Commande #4821", "+2 500 HTG"],
                ["Commande #4820", "+1 250 HTG"],
                ["Commande #4819", "+3 800 HTG"],
              ].map(([label, amount]) => (
                <div key={label} className="flex items-center justify-between border-t border-[#213246] py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#12362E]">
                      <Check className="h-3.5 w-3.5 text-[#4EE3A8]" />
                    </span>
                    <span className="text-xs font-medium text-[#C9D4E0]">{label}</span>
                  </div>
                  <span className="text-xs font-bold text-white">{amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-3 hidden items-center gap-3 rounded-md border border-[#2A4055] bg-[#102033] px-4 py-3 shadow-xl sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#12362E]">
          <CheckCircle2 className="h-4 w-4 text-[#4EE3A8]" />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase text-[#8297AC]">Webhook reçu</p>
          <p className="text-xs font-bold text-white">payment.succeeded</p>
        </div>
      </div>
    </motion.div>
  );
}

export function Hero() {
  const { t } = useTranslation();

  const benefits = [
    t("home.benefitSetup") || "Aucun frais d'installation",
    t("home.benefitMonthly") || "Sans abonnement mensuel",
    t("home.benefitRealtime") || "Confirmation en temps réel",
  ];

  return (
    <section className="relative overflow-hidden border-b border-[#1D3044] bg-[#06101A] pt-24 md:pt-28">
      <div className="absolute inset-y-0 right-0 hidden w-[44%] bg-[#091522] lg:block" />
      <div className="relative mx-auto grid min-h-[590px] max-w-[1360px] items-center gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16 lg:px-10 xl:px-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="max-w-[620px]"
        >
          <div className="mb-7 inline-flex items-center gap-2 rounded-md border border-[#2A4055] bg-[#0B1826] px-3 py-2 text-xs font-semibold text-[#C5D1DE]">
            <span className="h-2 w-2 rounded-full bg-[#FF5A2A]" />
            {t("home.heroBadge") || "Passerelle de paiement pour Haïti"}
          </div>

          <h1 className="max-w-[600px] text-[42px] font-extrabold leading-[1.08] text-white sm:text-[52px] lg:text-[64px]">
            {t("home.heroTitle1")} <span className="text-[#FF5A2A]">{t("home.heroTitle2")}</span> {t("home.heroTitle3")}
          </h1>

          <p className="mt-6 max-w-[570px] text-base leading-7 text-[#AFC0D2] md:text-lg md:leading-8">
            {t("home.heroDesc")}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#FF5A2A] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#E8481D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FF7C51]"
            >
              {t("home.getStarted") || "Commencer gratuitement"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="https://docs.kobara.app/docs/quickstart"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-[#31475D] bg-[#0A1724] px-6 py-3 text-sm font-bold text-white transition-colors hover:border-[#6D8297] hover:bg-[#102033] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t("home.viewDocs") || "Consulter la documentation"}
            </Link>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-[#B9C6D4] sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#4EE3A8]" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <ProductPreview />
      </div>
    </section>
  );
}
