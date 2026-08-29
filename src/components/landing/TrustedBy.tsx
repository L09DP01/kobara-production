"use client";

import { Braces, Link2, Radio } from "lucide-react";
import Image from "next/image";

import { useTranslation } from "@/context/LanguageContext";

export function TrustedBy() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-[#1D3044] bg-[#091522]">
      <div className="mx-auto grid max-w-[1360px] gap-6 px-5 py-8 sm:px-8 md:grid-cols-[1fr_auto] md:items-center lg:px-10 xl:px-12">
        <div>
          <p className="text-xs font-bold uppercase text-[#7F95AC]">{t("home.ecosystemLabel") || "Un seul espace pour vos paiements"}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex min-h-11 items-center gap-3 rounded-md border border-[#2A4055] bg-[#0D1A29] px-4">
              <Image src="/moncash.png" alt="MonCash" width={38} height={26} className="h-6 object-contain" style={{ width: "auto" }} />
              <span className="text-sm font-bold text-white">MonCash</span>
            </div>
            <div className="flex min-h-11 items-center gap-3 rounded-md border border-[#2A4055] bg-[#0D1A29] px-4">
              <Image src="/natcash.png" alt="NatCash" width={38} height={26} className="h-6 object-contain" style={{ width: "auto" }} />
              <span className="text-sm font-bold text-white">NatCash</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            [Braces, "API"],
            [Link2, t("home.linksShort") || "Liens"],
            [Radio, "Webhooks"],
          ].map(([Icon, label]) => {
            const FeatureIcon = Icon as typeof Braces;
            return (
              <div key={String(label)} className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1.5 rounded-md border border-[#24374A] px-4 text-center sm:min-w-24">
                <FeatureIcon className="h-4 w-4 text-[#FF6A35]" />
                <span className="text-xs font-semibold text-[#C7D3DF]">{String(label)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
