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
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[#1D3044] bg-[#06101A]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[76px] max-w-[1360px] items-center justify-between px-5 sm:px-8 lg:px-10 xl:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="Accueil Kobara">
          <Image src="/Icone.png" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-md" priority />
          <span className="text-lg font-extrabold text-white">Kobara</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Navigation principale">
          {navLinks.map((item) => (
            <Link
              key={item.href + item.name}
              href={item.href}
              className="text-sm font-semibold text-[#AFC0D2] transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF6A35]"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link href="/login" className="px-3 py-2 text-sm font-semibold text-[#C5D1DE] transition-colors hover:text-white">
            {t("nav.login") || "Connexion"}
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-[#FF5A2A] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#E8481D]"
          >
            {t("nav.signup") || "Créer un compte"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-md border border-[#2A4055] text-white md:hidden"
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
            className="border-t border-[#1D3044] bg-[#07121E] px-5 py-5 md:hidden"
            aria-label="Navigation mobile"
          >
            <div className="mx-auto flex max-w-lg flex-col">
              {navLinks.map((item) => (
                <Link
                  key={item.href + item.name}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center border-b border-[#1D3044] text-base font-semibold text-white last:border-b-0"
                >
                  {item.name}
                </Link>
              ))}
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center justify-center rounded-md border border-[#31475D] text-sm font-bold text-white"
                >
                  {t("nav.login") || "Connexion"}
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsOpen(false)}
                  className="flex min-h-12 items-center justify-center rounded-md bg-[#FF5A2A] text-sm font-bold text-white"
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
