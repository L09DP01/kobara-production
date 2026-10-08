import { ArrowRight, BadgeCheck, BookOpen, Code2, CreditCard, Landmark, LockKeyhole, Search, ShieldCheck, WalletCards } from "lucide-react";
import Link from "next/link";
import { HelpSearch } from "@/components/help/HelpSearch";
import { getHelpArticleHref, getHelpCategory, publishedHelpArticles, type HelpCategory } from "@/lib/help-center-content";

const iconMap = { payments: CreditCard, payouts: Landmark, verification: BadgeCheck, pricing: WalletCards, developers: Code2, security: ShieldCheck, balance: WalletCards, marketplace: BookOpen, legal: LockKeyhole, "getting-started": Search };
const priorityCategories = ["payments", "payouts", "verification", "pricing", "developers", "security"];
const popularPaths = ["payments/payment-status", "payouts/failed", "pricing/how-fees-work", "verification/proof-of-address", "developers/live-requirements", "balance/availability"];
const quickLinks = [
  { label: "Paiement en attente", path: "payments/payment-status" },
  { label: "Retrait échoué", path: "payouts/failed" },
  { label: "Comprendre les frais", path: "pricing/how-fees-work" },
  { label: "Vérifier mon compte", path: "verification/why-verify" },
  { label: "Passer en Live", path: "developers/live-requirements" },
  { label: "Intégrer l’API", href: "https://docs.kobara.app/docs/quickstart" },
];

export default function HelpHomePage() {
  const categories = priorityCategories.map((slug) => getHelpCategory(slug)).filter((item): item is HelpCategory => Boolean(item));
  const popular = popularPaths.map((path) => publishedHelpArticles.find((item) => item.path === path)).filter((item): item is (typeof publishedHelpArticles)[number] => Boolean(item));
  const searchArticles = publishedHelpArticles.map((item) => ({ ...item, categoryName: getHelpCategory(item.category)?.name ?? item.category }));

  return (
    <main className="text-[#10131D]">
      <section className="border-b border-[#E3DEDA] bg-[#FCF7F4] px-5 py-16 text-center sm:px-8 sm:py-24">
        <p className="text-sm font-extrabold uppercase text-[#D7471D]">Centre d’aide Kobara</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-[1.08] sm:text-6xl">Comment pouvons-nous vous aider ?</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#5C5E66] sm:text-lg">Recherchez une question sur vos paiements, retraits, vérifications ou intégrations.</p>
        <div className="mt-8"><HelpSearch articles={searchArticles} /></div>
        <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-3 text-sm">
          {quickLinks.map((item) => item.href ? <a key={item.label} href={item.href} className="font-semibold text-[#4F5159] underline decoration-[#F5B293] underline-offset-4 hover:text-[#D7471D]">{item.label}</a> : <Link key={item.label} href={`/help/${item.path}`} className="font-semibold text-[#4F5159] underline decoration-[#F5B293] underline-offset-4 hover:text-[#D7471D]">{item.label}</Link>)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="flex items-end justify-between gap-6">
          <div><p className="text-sm font-extrabold uppercase text-[#D7471D]">Parcourir l’aide</p><h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Les sujets les plus consultés</h2></div>
          <span className="hidden text-sm text-[#777981] sm:block">25 articles vérifiés</span>
        </div>
        <div className="mt-9 grid gap-px overflow-hidden rounded-lg border border-[#DED9D5] bg-[#DED9D5] sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = iconMap[category.icon];
            const count = publishedHelpArticles.filter((item) => item.category === category.slug).length;
            return <Link key={category.slug} href={`/help/${category.slug}`} className="group min-h-48 bg-white p-6 transition-colors hover:bg-[#FFF8F4] sm:p-7"><span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF0E9] text-[#E34A1F]"><Icon className="h-5 w-5" /></span><h3 className="mt-7 text-xl font-extrabold">{category.name}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-[#5C5E66]">{category.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#C93D18]">{count} article{count > 1 ? "s" : ""}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></Link>;
          })}
        </div>
      </section>

      <section className="border-y border-[#E3DEDA] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-20">
          <div><p className="text-sm font-extrabold uppercase text-[#D7471D]">Réponses rapides</p><h2 className="mt-2 text-3xl font-extrabold sm:text-4xl">Articles populaires</h2><p className="mt-4 max-w-md leading-7 text-[#5C5E66]">Des réponses courtes, précises et reliées à la documentation technique lorsque du code est nécessaire.</p></div>
          <div className="divide-y divide-[#E3DEDA] border-y border-[#E3DEDA]">
            {popular.map((item) => <Link key={item.id} href={getHelpArticleHref(item)} className="group flex min-h-20 items-center justify-between gap-5 py-4"><span><span className="block text-xs font-bold uppercase text-[#D7471D]">{getHelpCategory(item.category)?.name}</span><span className="mt-1 block font-bold text-[#10131D] group-hover:text-[#C93D18]">{item.title}</span></span><ArrowRight className="h-5 w-5 shrink-0 text-[#9D9EA3] transition-transform group-hover:translate-x-1 group-hover:text-[#F45D2C]" /></Link>)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-8 bg-[#10131D] px-6 py-9 text-white sm:px-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div><h2 className="text-2xl font-extrabold sm:text-3xl">Vous construisez avec Kobara ?</h2><p className="mt-3 max-w-2xl leading-7 text-white/70">Le Centre d’aide explique les opérations. La documentation développeur contient les endpoints, SDK et exemples de code.</p></div>
          <a href="https://docs.kobara.app" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-5 font-bold text-white hover:bg-[#E22F23]">Ouvrir la documentation <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>
    </main>
  );
}
