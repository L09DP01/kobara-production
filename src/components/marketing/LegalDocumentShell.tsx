import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Scale, Shield, UserMinus } from "lucide-react";

import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";

type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentShellProps = {
  language: string;
  activePath: "/terms" | "/privacy" | "/account-closure";
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalDocumentShell({ language, activePath, title, lastUpdated, intro, sections }: LegalDocumentShellProps) {
  const labels = language === "en"
    ? { navigation: "Legal navigation", terms: "Terms of Service", privacy: "Privacy Policy", closure: "Account closure", help: "Questions about this document?", contact: "Contact our team" }
    : language === "ht"
      ? { navigation: "Navigasyon legal", terms: "Kondisyon", privacy: "Konfidansyalite", closure: "Fèmen kont", help: "Kesyon sou dokiman sa a?", contact: "Kontakte ekip nou an" }
      : { navigation: "Navigation légale", terms: "Conditions d’utilisation", privacy: "Politique de confidentialité", closure: "Clôture de compte", help: "Une question sur ce document ?", contact: "Contacter notre équipe" };

  const links = [
    { href: "/terms" as const, label: labels.terms, icon: Scale },
    { href: "/privacy" as const, label: labels.privacy, icon: Shield },
    { href: "/account-closure" as const, label: labels.closure, icon: UserMinus },
  ];

  return (
    <div className="kobara-public min-h-[100dvh] bg-[#FCF7F4] text-[#10131D] selection:bg-[#F45D2C] selection:text-white">
      <PublicHeader />

      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[250px_minmax(0,760px)] lg:gap-16 lg:py-16">
        <aside>
          <div className="lg:sticky lg:top-24">
            <p className="mb-3 text-xs font-extrabold uppercase text-[#8A6960]">{labels.navigation}</p>
            <nav aria-label={labels.navigation} className="grid gap-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = href === activePath;
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-bold transition-colors ${active ? "bg-[#FFF1E9] text-[#B63316]" : "text-[#5C5E66] hover:bg-white hover:text-[#10131D]"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />{label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 border-t border-[#DDD7D3] pt-6">
              <FileText className="h-5 w-5 text-[#F45D2C]" />
              <p className="mt-3 text-sm font-bold text-[#10131D]">{labels.help}</p>
              <Link href="/contact" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-[#C64120] hover:text-[#E22F23]">
                {labels.contact}<ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </aside>

        <article className="min-w-0">
          <header className="border-b border-[#DDD7D3] pb-10">
            <p className="text-xs font-bold text-[#8A6960]">{lastUpdated}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight text-[#10131D] sm:text-5xl">{title}</h1>
            <p className="mt-5 whitespace-pre-line text-base leading-7 text-[#4F5158] sm:text-lg sm:leading-8">{intro}</p>
          </header>

          <div className="legal-copy">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-28 border-b border-[#DDD7D3] py-10 last:border-b-0 sm:py-12">
                <h2 className="mb-6 text-2xl font-extrabold leading-snug text-[#10131D]">{section.title}</h2>
                <div className="text-[15px] leading-7 text-[#4F5158]">{section.content}</div>
              </section>
            ))}
          </div>
        </article>
      </div>

      <Footer />
    </div>
  );
}
