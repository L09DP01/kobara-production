"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useTranslation } from "@/context/LanguageContext";

export function Navbar() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: t("nav.developers") || "Développeurs", href: "https://docs.kobara.app/docs/quickstart" },
    { name: t("nav.pricing") || "Tarifs", href: "/pricing" },
    { name: t("nav.documentation") || "Documentation", href: "https://docs.kobara.app/docs/quickstart" },
    { name: t("nav.contact") || "Contact", href: "/contact" },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#DDD7D3] bg-[#FCF7F4]/92 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-10 xl:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="Accueil Kobara">
          <Image src="/Icone.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-md" priority />
          <span className="text-lg font-extrabold text-[#10131D]">Kobara</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
          {navLinks.map((item) => (
            <Link
              key={item.href + item.name}
              href={item.href}
              className="text-sm font-semibold text-[#5C5E66] transition-colors hover:text-[#10131D] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F45D2C]"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-3 py-2 text-sm font-semibold text-[#333847] transition-colors hover:text-[#F45D2C]">
            {t("nav.login") || "Connexion"}
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#F45D2C] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E22F23]"
          >
            {t("nav.signup") || "Créer un compte"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-[#DDD7D3] bg-white text-[#10131D] md:hidden"
          aria-label={isOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="border-t border-[#DDD7D3] bg-[#FCF7F4] px-5 py-5 shadow-xl md:hidden"
            aria-label="Navigation mobile"
          >
            <div className="mx-auto flex max-w-lg flex-col">
              {navLinks.map((item) => (
                <Link
                  key={item.href + item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center border-b border-[#DDD7D3] text-base font-semibold text-[#10131D] last:border-b-0"
                >
                  {item.name}
                </Link>
              ))}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center justify-center rounded-md border border-[#C9C2BD] bg-white text-sm font-bold text-[#10131D]"
                >
                  {t("nav.login") || "Connexion"}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center justify-center rounded-md bg-[#F45D2C] text-sm font-bold text-white"
                >
                  {t("nav.signup") || "Créer un compte"}
                </Link>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
