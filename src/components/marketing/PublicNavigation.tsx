"use client";

import {
  ArrowRight,
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  ChevronDown,
  CircleHelp,
  Code2,
  CreditCard,
  FileCode2,
  Globe2,
  KeyRound,
  LayoutGrid,
  Link2,
  Menu,
  QrCode,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Store,
  Users,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type MenuName = "products" | "solutions" | "developers" | "resources";
type MenuItem = { label: string; description: string; href: string; icon: typeof CreditCard; badge?: string };

const productGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "Accepter des paiements",
    items: [
      { label: "Paiements en ligne", description: "Acceptez les paiements sur votre site ou application.", href: "/products/payments", icon: Globe2 },
      { label: "Checkout Kobara", description: "Un checkout hébergé, rapide et optimisé.", href: "/products/checkout", icon: CreditCard },
      { label: "Bouton de paiement", description: "Ajoutez Kobara avec un bouton simple.", href: "/products/payments#payment-button", icon: Zap },
      { label: "Liens de paiement", description: "Encaissez sans site web avec un lien.", href: "/products/payment-links", icon: Link2 },
    ],
  },
  {
    title: "Vendre partout",
    items: [
      { label: "QR Codes", description: "Un scan suffit pour ouvrir le paiement.", href: "/products/qr-codes", icon: QrCode },
      { label: "Factures", description: "Créez des factures payables en ligne.", href: "/products/invoices", icon: ReceiptText },
      { label: "Moyens de paiement", description: "MonCash, NatCash et options activées.", href: "/products/payment-methods", icon: LayoutGrid },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "API Payments", description: "Intégrez les paiements à votre plateforme.", href: "https://docs.kobara.app/docs/payments", icon: Code2 },
      { label: "Webhooks", description: "Recevez les confirmations en temps réel.", href: "https://docs.kobara.app/docs/webhooks", icon: Webhook },
      { label: "SDKs", description: "JavaScript, Node.js, Python et PHP.", href: "/developers/sdks", icon: FileCode2 },
    ],
  },
];

const solutionItems: MenuItem[] = [
  { label: "E-commerce", description: "Un checkout local pour convertir davantage.", href: "/solutions/ecommerce", icon: ShoppingBag },
  { label: "WooCommerce", description: "Ajoutez Kobara à votre boutique WordPress.", href: "/solutions/woocommerce", icon: Store },
  { label: "Applications mobiles", description: "Des paiements intégrés dans vos apps.", href: "/solutions/mobile-apps", icon: Smartphone },
  { label: "SaaS", description: "Automatisez les paiements de votre logiciel.", href: "/solutions/saas", icon: Boxes },
  { label: "Petites entreprises", description: "Encaissez sans infrastructure complexe.", href: "/solutions/small-business", icon: BriefcaseBusiness },
  { label: "Marketplaces", description: "Construisez des flux de paiement avancés.", href: "/solutions/marketplaces", icon: LayoutGrid },
  { label: "Agences & développeurs", description: "Intégrez Kobara pour vos clients.", href: "/solutions/agencies", icon: Code2 },
  { label: "Créateurs & indépendants", description: "Liens et QR codes pour être payé vite.", href: "/solutions/creators", icon: Users },
];

const developerGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "Commencer",
    items: [
      { label: "Documentation", description: "Toute la documentation Kobara.", href: "https://docs.kobara.app/docs/quickstart", icon: BookOpen },
      { label: "Quickstart", description: "Créez votre premier paiement.", href: "https://docs.kobara.app/docs/quickstart", icon: Zap },
      { label: "API Reference", description: "Endpoints, paramètres et réponses.", href: "https://docs.kobara.app/docs/payments", icon: FileCode2 },
    ],
  },
  {
    title: "Construire",
    items: [
      { label: "API Payments", description: "Créez et suivez vos paiements.", href: "https://docs.kobara.app/docs/payments", icon: CreditCard },
      { label: "Webhooks", description: "Synchronisez les statuts en temps réel.", href: "https://docs.kobara.app/docs/webhooks", icon: Webhook },
      { label: "SDKs & Libraries", description: "Utilisez votre langage préféré.", href: "/developers/sdks", icon: Code2 },
      { label: "API Keys", description: "Créez et révoquez vos accès.", href: "https://docs.kobara.app/docs/api-keys", icon: KeyRound },
    ],
  },
  {
    title: "Écosystème",
    items: [
      { label: "Developer Program", description: "Intégrez Kobara pour vos clients.", href: "/developer", icon: Users },
      { label: "Developer Dashboard", description: "Gérez vos marchands connectés.", href: "/developer/login", icon: LayoutGrid },
      { label: "Erreurs API", description: "Comprenez les codes et leurs solutions.", href: "https://docs.kobara.app/docs/errors", icon: CircleHelp },
    ],
  },
];

const resourceGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "Apprendre",
    items: [
      { label: "Centre d’aide", description: "Réponses pour les marchands.", href: "/help", icon: CircleHelp },
      { label: "FAQ", description: "Questions fréquentes sur Kobara.", href: "/resources/faq", icon: CircleHelp },
    ],
  },
  {
    title: "Développeurs",
    items: [
      { label: "Documentation", description: "Intégrez les API Kobara.", href: "https://docs.kobara.app", icon: BookOpen },
      { label: "API Reference", description: "Explorez les ressources API.", href: "https://docs.kobara.app/docs/payments", icon: FileCode2 },
    ],
  },
  {
    title: "Confiance",
    items: [
      { label: "Confidentialité", description: "Comprenez l’usage de vos données.", href: "/privacy", icon: ShieldCheck },
      { label: "Support", description: "Contactez directement notre équipe.", href: "/contact", icon: Users },
    ],
  },
];

function Brand() {
  return (
    <Link href="/" aria-label="Accueil Kobara" className="flex items-center gap-3">
      <Image src="/Icone.png" alt="" width={30} height={30} className="h-7 w-7 rounded" />
      <span className="text-xl font-extrabold text-[#10131D]">KOBARA</span>
    </Link>
  );
}

function MenuLink({ item, onClick }: { item: MenuItem; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onClick} className="group flex gap-3 rounded-md p-2.5 transition-colors hover:bg-[#FFF1E9] focus-visible:outline-2 focus-visible:outline-[#F45D2C]">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#DDD7D3] bg-white text-[#F45D2C]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-bold text-[#10131D]">
          {item.label}
          {item.badge && <span className="rounded bg-[#FBCDB1] px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-[#9B2C16]">{item.badge}</span>}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-[#5C5E66]">{item.description}</span>
      </span>
    </Link>
  );
}

function MegaPanel({ name, close }: { name: MenuName; close: () => void }) {
  const groups = name === "products" ? productGroups : name === "developers" ? developerGroups : name === "resources" ? resourceGroups : null;

  return (
    <div className="absolute inset-x-0 top-[72px] border-y border-[#DDD7D3] bg-white shadow-[0_24px_50px_rgba(16,19,29,0.12)]">
      <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8">
        {name === "solutions" ? (
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {solutionItems.map((item) => <MenuLink key={item.href} item={item} onClick={close} />)}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-3">
            {groups?.map((group) => (
              <section key={group.title}>
                <h2 className="mb-3 text-[11px] font-extrabold uppercase text-[#9D9EA3]">{group.title}</h2>
                <div className="space-y-1">{group.items.map((item) => <MenuLink key={item.href + item.label} item={item} onClick={close} />)}</div>
              </section>
            ))}
          </div>
        )}

        {name === "products" && (
          <Link href="/products/payments" onClick={close} className="mt-6 flex items-center justify-between rounded-md bg-[#F45D2C] px-5 py-4 text-white">
            <span><strong className="block text-sm">Découvrez Kobara Payments</strong><span className="mt-1 block text-xs text-white/80">Une infrastructure pour accepter les paiements locaux et internationaux.</span></span>
            <span className="flex items-center gap-2 text-sm font-bold">Voir tous les produits <ArrowRight className="h-4 w-4" /></span>
          </Link>
        )}

        {name === "developers" && (
          <div className="mt-6 grid overflow-hidden rounded-md border border-[#333847] bg-[#10131D] text-white md:grid-cols-[1fr_1.1fr]">
            <div className="p-5"><strong className="text-lg">Kobara for Developers</strong><p className="mt-1 text-sm text-white/65">Build payments into your product.</p></div>
            <pre className="overflow-x-auto border-t border-white/10 bg-[#171B27] p-5 text-xs leading-6 text-[#D7DBE7] md:border-l md:border-t-0"><code>{`const payment = await kobara.payments.create({\n  amount: 2500,\n  currency: "HTG"\n});`}</code></pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function PublicHeader() {
  const [active, setActive] = useState<MenuName | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const menus: { id: MenuName; label: string }[] = [
    { id: "products", label: "Produits" },
    { id: "solutions", label: "Solutions" },
    { id: "developers", label: "Développeurs" },
    { id: "resources", label: "Ressources" },
  ];

  return (
    <header className="sticky top-0 z-[70] border-b border-[#DDD7D3] bg-white/95 text-[#10131D] backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-5 sm:px-8">
        <Brand />
        <nav aria-label="Navigation principale" className="hidden items-center gap-1 lg:flex">
          {menus.map((menu) => (
            <button
              key={menu.id}
              type="button"
              onMouseEnter={() => setActive(menu.id)}
              onFocus={() => setActive(menu.id)}
              onClick={() => setActive(active === menu.id ? null : menu.id)}
              className="flex h-11 items-center gap-1.5 px-3 text-sm font-semibold text-[#333847] hover:text-[#F45D2C]"
              aria-expanded={active === menu.id}
            >
              {menu.label}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${active === menu.id ? "rotate-180" : ""}`} />
            </button>
          ))}
          <Link href="/pricing" onMouseEnter={() => setActive(null)} className="px-3 py-3 text-sm font-semibold text-[#333847] hover:text-[#F45D2C]">Tarifs</Link>
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
          <Link href="/login" className="text-sm font-semibold hover:text-[#F45D2C]">Connexion</Link>
          <Link href="/register" className="kobara-cta inline-flex min-h-10 items-center gap-2 rounded-md bg-[#F45D2C] px-5 text-sm font-bold text-white hover:bg-[#E22F23]">Créer un compte<ArrowRight className="h-4 w-4" /></Link>
        </div>
        <button type="button" onClick={() => setMobileOpen(!mobileOpen)} className="grid h-11 w-11 place-items-center rounded-md border border-[#DDD7D3] bg-white lg:hidden" aria-label={mobileOpen ? "Fermer le menu" : "Ouvrir le menu"}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div className="hidden lg:block" onMouseLeave={() => setActive(null)}>{active && <MegaPanel name={active} close={() => setActive(null)} />}</div>

      {mobileOpen && (
        <nav className="max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-[#DDD7D3] bg-white px-5 py-4 lg:hidden">
          {menus.map((menu) => (
            <div key={menu.id} className="border-b border-[#DDD7D3]">
              <button type="button" onClick={() => setActive(active === menu.id ? null : menu.id)} className="flex min-h-12 w-full items-center justify-between font-bold">
                {menu.label}<ChevronDown className={`h-4 w-4 ${active === menu.id ? "rotate-180" : ""}`} />
              </button>
              {active === menu.id && (
                <div className="grid grid-cols-2 gap-x-4 pb-4">
                  {(menu.id === "solutions" ? solutionItems : (menu.id === "products" ? productGroups : menu.id === "developers" ? developerGroups : resourceGroups).flatMap((group) => group.items)).map((item) => (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      onClick={() => { setMobileOpen(false); setActive(null); }}
                      className="flex min-h-10 items-center border-b border-[#EEE9E5] py-2 text-sm font-semibold leading-5 text-[#5C5E66] transition-colors hover:text-[#F45D2C]"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/pricing" onClick={() => setMobileOpen(false)} className="flex min-h-12 items-center border-b border-[#DDD7D3] font-bold">Tarifs</Link>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/login" className="grid min-h-12 place-items-center rounded-md border border-[#10131D] font-bold">Connexion</Link>
            <Link href="/register" className="kobara-cta grid min-h-12 place-items-center rounded-md bg-[#F45D2C] font-bold text-white">Créer un compte</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
