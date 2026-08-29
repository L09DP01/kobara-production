"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Check } from "lucide-react";

export function PricingClient({ language, plans }: { language: string, plans: any[] }) {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <>
      <section className="pb-12 relative text-center">
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm font-bold ${!isYearly ? "text-white" : "text-[#AAB3C2]"}`}>
            {language === "fr" ? "Mensuel" : "Monthly"}
          </span>
          <button
            onClick={() => setIsYearly(!isYearly)}
            className="w-14 h-8 rounded-full bg-[#1E2A38] p-1 relative transition-colors focus:outline-none"
          >
            <div
              className={`w-6 h-6 rounded-full bg-[#FF4A1C] shadow-lg transition-transform duration-300 ${
                isYearly ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm font-bold flex items-center gap-2 ${isYearly ? "text-white" : "text-[#AAB3C2]"}`}>
            {language === "fr" ? "Annuel" : "Yearly"}
            <span className="text-[10px] uppercase bg-[#FF4A1C]/20 text-[#FF4A1C] px-2 py-0.5 rounded-full border border-[#FF4A1C]/30">
              -20%
            </span>
          </span>
        </div>
      </section>

      {/* ── Plans grid ── */}
      <section className="pb-24 relative">
        <div className="max-w-[1340px] mx-auto px-5 sm:px-8">
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {plans.map((plan) => {
              // Apply 20% discount logic
              const rawPrice = plan.price;
              let displayPrice = plan.priceLabel;
              let periodLabel = plan.period;
              let ctaHref = plan.ctaHref;

              if (rawPrice && isYearly) {
                // 20% discount => price * 0.8
                // For a year, we charge for 12 months * price * 0.8 => Or just show monthly equivalent
                const discountedMonthly = rawPrice * 0.8;
                displayPrice = discountedMonthly.toLocaleString('fr-FR');
                // Append `&billing=yearly` to checkout URL if it has a plan parameter
                if (ctaHref.includes("?plan=")) {
                  ctaHref += "&billing=yearly";
                }
              }

              return (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-[28px] overflow-hidden border transition-all duration-300 hover:-translate-y-2 group
                    ${plan.highlight
                      ? "bg-[#07111F] border-[#FF4A1C]/50 shadow-[0_10px_40px_rgba(255,74,28,0.2)]"
                      : "bg-[#07111F] border-[#1E2A38] hover:border-[#AAB3C2]/30 shadow-lg"
                    }`}
                >
                  {/* Highlight Glow inside card */}
                  {plan.highlight && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[1px] bg-gradient-to-r from-transparent via-[#FF4A1C] to-transparent opacity-80" />
                  )}

                  {/* Badge */}
                  {plan.badge && (
                    <div className="absolute top-5 right-5 z-10">
                      <span className="text-xs font-black px-3 py-1 rounded-full bg-[#FF4A1C]/10 border border-[#FF4A1C]/20 text-[#FF4A1C] shadow-[0_0_10px_rgba(255,74,28,0.2)]">
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div className="p-8 flex flex-col flex-1 relative z-10">
                    {/* Plan name */}
                    <div className={`text-sm font-bold uppercase tracking-widest mb-3 ${plan.highlight ? "text-[#FF4A1C]" : "text-[#AAB3C2]"}`}>
                      {plan.name}
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <div className="text-[3.5rem] font-black leading-none tracking-tighter text-white flex items-end">
                        {displayPrice}
                        {periodLabel && (
                          <span className="text-base font-semibold ml-2 text-[#AAB3C2] tracking-normal mb-2">
                            {periodLabel}
                          </span>
                        )}
                      </div>
                      {rawPrice && isYearly && (
                        <div className="text-sm text-[#22C55E] font-medium mt-1">
                          {language === "fr" ? "Facturé" : "Billed"} {((rawPrice * 0.8) * 12).toLocaleString('fr-FR')} HTG / an
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm font-medium leading-relaxed mb-8 text-[#AAB3C2] min-h-[40px]">
                      {plan.description}
                    </p>

                    {/* CTA Button */}
                    <Link
                      href={ctaHref}
                      className={`w-full h-13 rounded-xl font-bold text-[15px] flex items-center justify-center gap-2 mb-8 transition-all
                        ${plan.highlight
                          ? "bg-[#FF4A1C] hover:bg-[#FF2E14] text-white shadow-[0_0_20px_rgba(255,74,28,0.3)] hover:shadow-[0_0_30px_rgba(255,74,28,0.5)] active:scale-95"
                          : "bg-[#020B14] border border-[#1E2A38] hover:border-[#AAB3C2] text-white active:scale-95"
                        }`}
                    >
                      {plan.cta}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    {/* Divider */}
                    <div className="border-t border-[#1E2A38] mb-8" />

                    {/* Features */}
                    <ul className="space-y-4 flex-1">
                      {plan.features.map((feature: string, j: number) => (
                        <li key={j} className="flex items-start gap-3">
                          <CheckCircle2 className={`w-5 h-5 shrink-0 ${plan.highlight ? "text-[#FF4A1C]" : "text-[#AAB3C2]"}`} />
                          <span className="text-sm font-medium leading-snug text-[#AAB3C2]">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* Fee note */}
                    {plan.feeNote && (
                      <p className="text-[12px] text-[#AAB3C2]/70 font-medium mt-6 leading-relaxed">
                        {plan.feeNote}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comparison note */}
          <div className="mt-12 text-center">
            <p className="text-[#AAB3C2] font-medium">
              {language === "fr" 
                ? "Tous les plans incluent l'accès au dashboard, les notifications et l'intégration MonCash."
                : "All plans include dashboard access, notifications, and MonCash integration."}
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
