"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck, BarChart3, BookOpen, CreditCard, Headphones, KeyRound,
  LayoutDashboard, LogOut, Menu, Settings, Users, WalletCards, Webhook, X,
} from "lucide-react";
import { performFullLogout } from "@/lib/utils/logout-client";
import { siteConfig } from "@/config/site";

interface SidebarLink {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  ownerOnly?: boolean;
}

const SIDEBAR_SECTIONS: Array<{ title: string; links: SidebarLink[] }> = [
  { title: "Général", links: [{ href: "/dashboard", icon: LayoutDashboard, label: "Vue d'ensemble", exact: true }] },
  {
    title: "Opérations",
    links: [
      { href: "/payments", icon: CreditCard, label: "Paiements" },
      { href: "/customers", icon: Users, label: "Clients" },
      { href: "/withdrawals", icon: WalletCards, label: "Retraits", ownerOnly: true },
    ],
  },
  {
    title: "Développeurs",
    links: [
      { href: "/api-keys", icon: KeyRound, label: "Clés API" },
      { href: "/webhooks", icon: Webhook, label: "Webhooks" },
      { href: "/developers", icon: BookOpen, label: "Documentation" },
    ],
  },
  {
    title: "Entreprise",
    links: [
      { href: "/analytics", icon: BarChart3, label: "Analyses" },
      { href: "/kyc", icon: BadgeCheck, label: "Vérification KYC", ownerOnly: true },
      { href: "/settings", icon: Settings, label: "Paramètres" },
    ],
  },
];

function isLinkActive(pathname: string | null, link: SidebarLink) {
  if (link.exact) return pathname === link.href;
  return pathname?.startsWith(link.href) ?? false;
}

export function DesktopSidebar({ userRole = "owner" }: { userRole?: string }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-[#223047] bg-[#091321] text-slate-300 lg:flex">
      <SidebarContent pathname={pathname} onClose={() => {}} userRole={userRole} />
    </aside>
  );
}

export function MobileSidebar({ isOpen, onClose, userRole = "owner" }: { isOpen: boolean; onClose: () => void; userRole?: string }) {
  const pathname = usePathname();
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <div
        className={clsx("fixed inset-0 z-40 bg-black/65 backdrop-blur-[2px] transition-opacity duration-200", isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={clsx("fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[88vw] flex-col overflow-hidden border-r border-[#223047] bg-[#091321] text-slate-300 shadow-2xl transition-transform duration-200 ease-out", isOpen ? "translate-x-0" : "-translate-x-full")}
        aria-hidden={!isOpen}
      >
        <SidebarContent pathname={pathname} onClose={onClose} userRole={userRole} />
      </aside>
    </div>
  );
}

export function MobileBottomNav({ onOpenMore, userRole = "owner" }: { onOpenMore: () => void; userRole?: string }) {
  const pathname = usePathname();
  const items: SidebarLink[] = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Accueil", exact: true },
    { href: "/payments", icon: CreditCard, label: "Paiements" },
    { href: "/customers", icon: Users, label: "Clients" },
    userRole === "owner" ? { href: "/withdrawals", icon: WalletCards, label: "Retraits" } : { href: "/api-keys", icon: KeyRound, label: "API" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid h-[72px] grid-cols-5 border-t border-[#223047] bg-[#091321]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navigation principale">
      {items.map((item) => {
        const active = isLinkActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={clsx("flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors duration-150", active ? "text-orange-400" : "text-slate-500 hover:text-slate-200")}>
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={onOpenMore} className="flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-slate-500 transition-colors duration-150 hover:text-slate-200" aria-label="Ouvrir le menu complet">
        <Menu className="h-5 w-5" aria-hidden="true" />
        <span>Plus</span>
      </button>
    </nav>
  );
}

function SidebarContent({ pathname, onClose, userRole }: { pathname: string | null; onClose: () => void; userRole: string }) {
  return (
    <>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#223047] px-5">
        <a href={siteConfig.url} className="flex items-center" aria-label="Accueil Kobara">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo2.png" alt="Kobara" className="h-auto w-28 object-contain" />
        </a>
        <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Fermer le menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-3 py-5" aria-label="Menu du dashboard">
        {SIDEBAR_SECTIONS.map((section) => {
          const visibleLinks = section.links.filter((link) => !link.ownerOnly || userRole === "owner");
          if (visibleLinks.length === 0) return null;
          return (
            <section key={section.title}>
              <h2 className="mb-2 px-3 text-[10px] font-bold uppercase text-slate-600">{section.title}</h2>
              <div className="space-y-1">
                {visibleLinks.map((link) => {
                  const active = isLinkActive(pathname, link);
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href} onClick={onClose} className={clsx("group flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors duration-150", active ? "bg-orange-500/12 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-100")}>
                      <Icon className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-orange-400" : "text-slate-500 group-hover:text-slate-300")} />
                      <span>{link.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden="true" />}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[#223047] p-3">
        <Link href="/support" onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-slate-400 transition-colors duration-150 hover:bg-white/5 hover:text-white">
          <Headphones className="h-[18px] w-[18px]" /><span>Support client</span>
        </Link>
        <button type="button" onClick={() => performFullLogout()} className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-red-400 transition-colors duration-150 hover:bg-red-500/10">
          <LogOut className="h-[18px] w-[18px]" /><span>Déconnexion</span>
        </button>
      </div>
    </>
  );
}
