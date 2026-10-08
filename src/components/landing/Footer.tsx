"use client";

import Image from "next/image";
import Link from "next/link";

import { useTranslation } from "@/context/LanguageContext";

import { LanguageSwitcher } from "./LanguageSwitcher";

const groups = [
  {
    title: "Produit",
    links: [
      { label: "Tarifs", href: "/pricing" },
      { label: "Créer un compte", href: "/register" },
      { label: "Connexion", href: "/login" },
    ],
  },
  {
    title: "Développeurs",
    links: [
      { label: "Documentation", href: "https://docs.kobara.app/docs/quickstart" },
      { label: "Programme Developer", href: "/developer" },
      { label: "API Kobara", href: "https://docs.kobara.app/docs/payments" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { label: "Centre d’aide", href: "/help" },
      { label: "Contact", href: "/contact" },
      { label: "Ambassadeurs", href: "/partnership/ambassador" },
      { label: "Clôture de compte", href: "/account-closure" },
    ],
  },
];

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-[#DDD7D3] bg-[#FCF7F4] py-12 text-[#10131D]">
      <div className="mx-auto max-w-[1360px] px-5 sm:px-8 lg:px-10 xl:px-12">
        <div className="grid gap-10 border-b border-[#DDD7D3] pb-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3" aria-label="Accueil Kobara">
              <Image src="/Icone.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-md" />
              <span className="text-xl font-black">Kobara</span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-[#5C5E66]">
              {t("home.heroDesc") || "Une infrastructure de paiement conçue pour les entreprises en Haïti."}
            </p>
          </div>

          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-bold text-[#10131D]">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-[#5C5E66] transition-colors hover:text-[#F45D2C]">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-5 pt-7 text-sm text-[#5C5E66] md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Kobara. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/terms" className="hover:text-[#F45D2C]">{t("nav.terms") || "Conditions"}</Link>
            <Link href="/privacy" className="hover:text-[#F45D2C]">{t("nav.privacy") || "Confidentialité"}</Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>
    </footer>
  );
}
