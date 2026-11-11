'use client';

import AdminSessionManager from "@/components/admin/AdminSessionManager";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Terminal,
  Activity,
  Users,
  ShieldAlert,
  CreditCard,
  Banknote,
  Landmark,
  LifeBuoy,
  SearchCode,
  LogOut,
  Mail,
  Tag,
  Layers,
  ReceiptText,
  MonitorSmartphone,
  UserCog,
  HeartPulse,
  BellRing,
  BriefcaseBusiness,
  Handshake,
  FileBarChart,
  Menu,
  X,
  MessageCircleMore,
  ScrollText
} from "lucide-react";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const close = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', close);
    return () => desktop.removeEventListener('change', close);
  }, []);

  const navItems = [
    { name: "DASHBOARD", href: "/system-core/dashboard", icon: Activity },
    { name: "PAYMENT PROVIDERS", href: "/system-core/payment-provider", icon: Layers },
    { name: "TREASURY", href: "/system-core/treasury", icon: Landmark },
    { name: "MERCHANTS", href: "/system-core/merchants", icon: Users },
    { name: "KYC REVIEW", href: "/system-core/kyc", icon: ShieldAlert },
    { name: "TRANSACTIONS", href: "/system-core/transactions", icon: CreditCard },
    { name: "BUSINESS REQUESTS", href: "/system-core/business-requests", icon: BriefcaseBusiness },
    { name: "PARTNERS", href: "/system-core/partners", icon: Handshake },
    { name: "REPORTS", href: "/system-core/reports", icon: FileBarChart },
    { name: "WITHDRAWALS", href: "/system-core/withdrawals", icon: Banknote },
    { name: "SUPPORT", href: "/system-core/support", icon: LifeBuoy },
    { name: "SHOPIFY PRIVACY", href: "/system-core/shopify-privacy", icon: ShieldAlert },
    { name: "MOTEUR CGU", href: "/system-core/legal/cgu-rules", icon: ScrollText },
    { name: "WHATSAPP", href: "/system-core/whatsapp", icon: MessageCircleMore },
    { name: "SYSTEM LOGS", href: "/system-core/logs", icon: ScrollText },
    { name: "SUPABASE LOGS", href: "/system-core/logs/supabase", icon: ScrollText },
    { name: "CLOUDFLARE LOGS", href: "/system-core/logs/cloudflare", icon: ScrollText },
    { name: "AUDIT LOGS", href: "/system-core/audit", icon: SearchCode },
    { name: "SESSIONS", href: "/system-core/sessions", icon: MonitorSmartphone },
    { name: "ADMINISTRATORS", href: "/system-core/administrators", icon: UserCog },
    { name: "SYSTEM HEALTH", href: "/system-core/health", icon: HeartPulse },
    { name: "ALERTS & MAINTENANCE", href: "/system-core/alerts", icon: BellRing },
    { name: "MESSAGING", href: "/system-core/messaging", icon: Mail },
    { name: "PROMOTIONS IA", href: "/system-core/smart-promotions", icon: Mail },
    { name: "PROMO CODES", href: "/system-core/promo-codes", icon: Tag },
    { name: "SMS GATEWAY", href: "/system-core/sms-gateway", icon: Terminal },
  ];

  const sidebar = <>
          <div className="p-6 border-b border-slate-800 flex items-center gap-4">
            <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center font-bold text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]">
              K
            </div>
            <div>
              <div className="font-bold text-slate-200 tracking-wider">CORE_SYSTEM</div>
              <div className="text-[10px] text-green-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                ONLINE
              </div>
            </div>
            <button aria-label="Fermer" onClick={() => setMenuOpen(false)} className="ml-auto p-1 text-slate-400 md:hidden"><X className="w-5 h-5" /></button>
          </div>

          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <div className="text-xs font-semibold text-slate-500 mb-4 px-2 tracking-widest">MODULES</div>
            {navItems.map((item) => {
              const isActive = pathname === item.href || (pathname.startsWith(item.href + '/') &&
                !navItems.some(other => other.href !== item.href && other.href.startsWith(item.href + '/') &&
                  (pathname === other.href || pathname.startsWith(other.href + '/'))));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all text-sm tracking-wider ${
                    isActive
                      ? "bg-red-950/40 text-red-400 border-l-2 border-red-500"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-l-2 border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <Link
              href="/api/admin/auth/logout"
              prefetch={false}
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm tracking-wider text-red-500 hover:text-red-400 hover:bg-red-950/30 transition-all border border-red-900/30"
            >
              <LogOut className="w-4 h-4" />
              TERMINATE SESSION
            </Link>
          </div>
        </>;

  return (
    <div className="fixed inset-0 flex min-w-0 bg-slate-950 font-mono text-slate-100 selection:bg-red-500/30">
      <AdminSessionManager>
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 md:flex">{sidebar}</aside>
        <DialogPrimitive.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay data-modal-scrim className="fixed inset-0 z-50 bg-black/65 md:hidden" />
            <DialogPrimitive.Content aria-describedby={undefined} onCloseAutoFocus={event => {
              event.preventDefault(); document.getElementById('admin-menu-trigger')?.focus();
            }} className="fixed inset-y-0 left-0 z-50 flex w-[min(320px,90vw)] flex-col border-r border-slate-700 bg-slate-900 text-white md:hidden">
              <DialogPrimitive.Title className="sr-only">Menu System Core</DialogPrimitive.Title>
              {sidebar}
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        {/* Main Content Area */}
        <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden">
          {/* Topbar for mobile and breadcrumbs/status */}
          <header className="flex h-16 min-w-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/30 px-3 backdrop-blur-md sm:px-6">
            <div className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
              <button id="admin-menu-trigger" aria-label="Ouvrir le menu" aria-expanded={menuOpen} aria-haspopup="dialog" onClick={() => setMenuOpen(true)} className="p-1 -ml-2 md:hidden"><Menu className="w-5 h-5" /></button>
              <Terminal className="w-4 h-4" />
              <span className="text-slate-500">~</span>
              <span className="truncate text-slate-300">{pathname.replace('/system-core', '') || '/dashboard'}</span>
            </div>
            
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-700/50 bg-slate-800/50 px-2.5 py-1 text-xs text-slate-500 sm:px-3">
              <ShieldAlert className="w-3 h-3 text-red-500" />
              ADMIN
            </div>
          </header>

          {/* Page Content */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-8">
            <div className="mx-auto min-w-0 max-w-7xl [&_button]:focus-visible:outline-none [&_button]:focus-visible:ring-2 [&_button]:focus-visible:ring-red-500 [&_input]:min-w-0 [&_select]:min-w-0">
              {children}
            </div>
          </main>
        </div>
      </AdminSessionManager>
    </div>
  );
}
