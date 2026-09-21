'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LayoutDashboard, LogOut, Settings, Share2, Users } from 'lucide-react';

export function PartnerPortalShell({ role, name, children }: { role: 'developer' | 'ambassador'; name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const base = `/${role}/portal`;
  const links = role === 'developer' ? [
    [base, 'Dashboard', LayoutDashboard], [`${base}/referrals`, 'Référencement', Share2], [`${base}/clients`, 'Clients', Users], [`${base}/analytics`, 'Analyses', BarChart3], [`${base}/settings`, 'Paramètres', Settings],
  ] : [[base, 'Dashboard', LayoutDashboard], [`${base}/analytics`, 'Analyses', BarChart3], [`${base}/settings`, 'Paramètres', Settings]];
  return <div className="min-h-[100dvh] bg-[#07101d] text-white lg:flex">
    <aside className="border-b border-slate-800 bg-[#091321] p-4 lg:fixed lg:inset-y-0 lg:w-60 lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between lg:block"><Link href={base} className="text-xl font-black">Kobara <span className="text-orange-500">{role === 'developer' ? 'Developer' : 'Ambassadeur'}</span></Link><span className="text-xs text-slate-500 lg:mt-2 lg:block">{name}</span></div>
      <nav className="mt-5 flex gap-2 overflow-x-auto lg:flex-col">
        {links.map(([href, label, Icon]) => { const I = Icon as typeof LayoutDashboard; const active = pathname === href || (href !== base && pathname.startsWith(String(href))); return <Link key={String(href)} href={String(href)} className={`flex min-w-fit items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold ${active ? 'bg-orange-500/15 text-orange-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}><I className="h-4 w-4"/>{String(label)}</Link>; })}
      </nav>
      <a href="/logout" className="mt-5 flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10"><LogOut className="h-4 w-4"/>Déconnexion</a>
    </aside>
    <main className="min-w-0 flex-1 p-4 sm:p-6 lg:ml-60 lg:p-8">{children}</main>
  </div>;
}
