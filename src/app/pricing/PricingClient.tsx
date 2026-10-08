"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

export type PricingPlan = {
  name: string;
  price: number | null;
  priceLabel: string;
  period: string | null;
  description: string;
  highlight: boolean;
  badge: string | null;
  features: string[];
  cta: string;
  ctaHref: string;
  feeNote: string | null;
};

type PricingClientProps = {
  language: string;
  plans: PricingPlan[];
};

export function PricingClient({ language, plans }: PricingClientProps) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section aria-labelledby="plans-title" className="border-b border-[#DDD7D3] py-9 sm:py-12">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <div className="flex flex-col gap-6 border-b border-[#DDD7D3] pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-bold text-[#F45D2C]">{language === "fr" ? "Tarifs Kobara" : "Kobara pricing"}</p>
            <h1 id="plans-title" className="mt-2 text-3xl font-extrabold leading-tight text-[#10131D] sm:text-4xl">
              {language === "fr" ? "Des tarifs clairs pour chaque étape." : "Clear pricing for every stage."}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5C5E66] sm:text-base">
              {language === "fr"
                ? "Commencez gratuitement, puis choisissez le volume, le contrôle et l’accompagnement adaptés à votre activité."
                : "Start for free, then choose the volume, control, and support that fit your business."}
            </p>
          </div>

          <div className="inline-flex w-fit rounded-md border border-[#D8D3CF] bg-white p-1" aria-label={language === "fr" ? "Cycle de facturation" : "Billing cycle"}>
            <button
              type="button"
              onClick={() => setIsYearly(false)}
              aria-pressed={!isYearly}
              className={`min-h-10 rounded px-4 text-sm font-bold transition-colors ${!isYearly ? "public-dark-panel bg-[#10131D] text-white" : "text-[#5C5E66] hover:text-[#10131D]"}`}
            >
              {language === "fr" ? "Mensuel" : "Monthly"}
            </button>
            <button
              type="button"
              onClick={() => setIsYearly(true)}
              aria-pressed={isYearly}
              className={`flex min-h-10 items-center gap-2 rounded px-4 text-sm font-bold transition-colors ${isYearly ? "public-dark-panel bg-[#10131D] text-white" : "text-[#5C5E66] hover:text-[#10131D]"}`}
            >
              {language === "fr" ? "Annuel" : "Yearly"}
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${isYearly ? "bg-white/15 text-white" : "bg-[#FFE5D8] text-[#B63316]"}`}>-20%</span>
            </button>
          </div>
        </div>

        <div className="grid border-x border-[#DDD7D3] sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const discountedMonthly = plan.price ? plan.price * 0.8 : null;
            const displayPrice = isYearly && discountedMonthly
              ? discountedMonthly.toLocaleString("fr-FR", { maximumFractionDigits: 0 })
              : plan.priceLabel;
            const billedYearly = discountedMonthly ? discountedMonthly * 12 : null;
            const ctaHref = isYearly && plan.ctaHref.includes("?plan=")
              ? `${plan.ctaHref}&billing=yearly`
              : plan.ctaHref;

            return (
              <article
                key={plan.name}
                className={`relative flex min-w-0 flex-col border-b border-r border-[#DDD7D3] p-6 sm:p-7 ${plan.highlight ? "bg-[#FFF1E9]" : "bg-white"}`}
              >
                {plan.highlight && <div className="absolute inset-x-0 top-0 h-1 bg-[#F45D2C]" />}

                <div className="flex min-h-7 items-center justify-between gap-3">
                  <h3 className="text-lg font-extrabold text-[#10131D]">{plan.name}</h3>
                  {plan.badge && (
                    <span className="kobara-cta inline-flex items-center gap-1 rounded bg-[#F45D2C] px-2 py-1 text-[10px] font-extrabold uppercase text-white">
                      <Sparkles className="h-3 w-3" />{plan.badge}
                    </span>
                  )}
                </div>

                <p className="mt-3 min-h-12 text-sm leading-6 text-[#5C5E66]">{plan.description}</p>

                <div className="mt-7 min-h-[86px]">
                  <div className="flex flex-wrap items-end gap-x-2 gap-y-1 text-[#10131D]">
                    <strong className="text-[2.6rem] leading-none">{displayPrice}</strong>
                    {plan.period && <span className="pb-1 text-sm font-semibold text-[#5C5E66]">{plan.period}</span>}
                  </div>
                  {isYearly && billedYearly && (
                    <p className="mt-2 text-xs font-semibold text-[#39715B]">
                      {language === "fr" ? "Facturé" : "Billed"} {billedYearly.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} HTG / {language === "fr" ? "an" : "year"}
                    </p>
                  )}
                </div>

                <Link
                  href={ctaHref}
                  className={`mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-extrabold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F45D2C] ${plan.highlight ? "kobara-cta bg-[#F45D2C] text-white hover:bg-[#E22F23]" : "border border-[#10131D] bg-white text-[#10131D] hover:bg-[#FFF1E9]"}`}
                >
                  {plan.cta}<ArrowRight className="h-4 w-4" />
                </Link>

                <div className="my-7 h-px bg-[#DDD7D3]" />

                <p className="mb-4 text-xs font-extrabold uppercase text-[#333847]">
                  {language === "fr" ? "Ce qui est inclus" : "What is included"}
                </p>
                <ul className="flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm leading-5 text-[#333847]">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FFE5D8] text-[#C64120]">
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.feeNote && <p className="mt-6 border-t border-[#DDD7D3] pt-4 text-xs leading-5 text-[#6E7077]">{plan.feeNote}</p>}
              </article>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-[#5C5E66]">
          {language === "fr"
            ? "Tous les plans incluent le dashboard Kobara, les notifications et l’intégration MonCash et NatCash."
            : "All plans include the Kobara dashboard, notifications, and MonCash and NatCash integration."}
        </p>
      </div>
    </section>
  );
}
