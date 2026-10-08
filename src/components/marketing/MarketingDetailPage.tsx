import { ArrowRight, CheckCircle2, CircleCheck, Code2, CreditCard, QrCode, ShieldCheck, Webhook } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { PublicPageContent } from "@/lib/public-site-content";
import { Footer } from "@/components/landing/Footer";
import { EditorialSignalBar } from "@/components/marketing/EditorialSignalBar";
import { PublicHeader } from "@/components/marketing/PublicNavigation";
import { ProductHeroVisual, type ProductHeroKind } from "@/components/marketing/ProductHeroVisual";
import { SolutionHeroVisual } from "@/components/marketing/SolutionHeroVisual";

export function MarketingDetailPage({ content, productKind, pageKind = "product", pageSlug = "" }: { content: PublicPageContent; productKind?: ProductHeroKind; pageKind?: "product" | "solution" | "resource"; pageSlug?: string }) {
  const editorialHero = pageKind === "resource";
  const nonProductPage = pageKind !== "product";
  const sectionLabel = pageKind === "resource" ? "À explorer" : pageKind === "solution" ? "Ce que Kobara apporte" : "Fonctionnalités";
  const finalTitle = pageKind === "resource" ? "Besoin d’un accompagnement précis ?" : pageKind === "solution" ? "Adaptez Kobara à votre activité." : "Prêt à construire avec Kobara ?";
  const finalDescription = pageKind === "resource" ? "Consultez la documentation ou contactez Kobara avec le contexte et les références utiles." : pageKind === "solution" ? "Commencez avec le parcours adapté à votre modèle ou échangez avec notre équipe." : "Créez votre compte ou échangez avec notre équipe pour choisir le parcours adapté.";
  const finalHref = nonProductPage ? content.primaryHref : "/register";
  const finalLabel = nonProductPage ? content.primaryLabel : "Créer un compte";
  return (
    <main className="kobara-public min-h-screen bg-[#FCF7F4] text-[#10131D]">
      <PublicHeader />

      <section className="relative overflow-hidden border-b border-[#D9DDE2] bg-[#F4F7FA]">
        <HeroBackdrop />
        <div aria-hidden className="pointer-events-none absolute inset-0 mx-auto grid max-w-[1200px] grid-cols-4 border-x border-[#D9DDE2]/70">
          {[0, 1, 2, 3].map((column) => <span key={column} className="border-r border-[#D9DDE2]/70 last:border-r-0" />)}
        </div>
        <div className={`relative mx-auto max-w-[1200px] px-5 sm:px-8 ${editorialHero ? "py-20 sm:py-28" : "grid min-h-[560px] items-center gap-14 py-16 lg:grid-cols-[0.95fr_1.05fr]"}`}>
          <div className={editorialHero ? "max-w-[880px]" : "max-w-[570px]"}>
            <p className="inline-flex rounded-full bg-[#FFF1E9] px-3 py-2 text-xs font-bold text-[#E22F23]">{content.eyebrow}</p>
            <h1 className={`mt-7 text-balance font-semibold leading-[1.04] ${editorialHero ? "text-4xl sm:text-6xl lg:text-7xl" : "text-4xl sm:text-6xl"}`}>{content.title}</h1>
            <p className={`mt-6 text-base leading-7 text-[#5C5E66] sm:text-lg sm:leading-8 ${editorialHero ? "max-w-[720px]" : "max-w-[560px]"}`}>{content.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={content.primaryHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-6 text-sm font-bold text-[#10131D] hover:bg-[#FC9A65]">
                {content.primaryLabel}<ArrowRight className="h-4 w-4" />
              </Link>
              {content.secondaryHref && content.secondaryLabel && (
                <Link href={content.secondaryHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[#C9C2BD] bg-white px-6 text-sm font-bold text-[#10131D] hover:border-[#F45D2C]">
                  {content.secondaryLabel}
                </Link>
              )}
            </div>
          </div>
          {pageKind === "resource" ? <EditorialSignalBar kind="resource" slug={pageSlug} /> : pageKind === "solution" ? <SolutionHeroVisual slug={pageSlug} /> : productKind ? <ProductHeroVisual kind={productKind} /> : <ContextVisual eyebrow={content.eyebrow} />}
        </div>
      </section>

      {content.flow && (
        <section className="border-b border-[#DDD7D3] bg-white">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
            <p className="text-xs font-extrabold uppercase text-[#F45D2C]">Comment ça marche</p>
            <div className="mt-8 grid gap-px overflow-hidden rounded-md border border-[#DDD7D3] bg-[#DDD7D3] md:grid-cols-5">
              {content.flow.map((step, index) => (
                <div key={step} className="bg-white p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFF1E9] text-xs font-black text-[#E22F23]">{index + 1}</span>
                  <p className="mt-5 text-sm font-bold leading-6">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {content.details?.map((detail, index) => (
        <section key={detail.title} className={`border-b border-[#DDD7D3] ${index % 2 === 0 ? "bg-[#FCF7F4]" : "bg-white"}`}>
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="max-w-xl">
              <p className="text-xs font-extrabold uppercase text-[#F45D2C]">{detail.kicker}</p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{detail.title}</h2>
              <p className="mt-5 text-base leading-7 text-[#5C5E66]">{detail.description}</p>
            </div>
            <div className="grid gap-px overflow-hidden rounded-md border border-[#DDD7D3] bg-[#DDD7D3] sm:grid-cols-2">
              {detail.bullets.map((bullet, bulletIndex) => (
                <div key={bullet} className="flex min-h-28 gap-4 bg-white p-5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#FFF1E9] text-xs font-black text-[#E22F23]">{bulletIndex + 1}</span>
                  <p className="text-sm font-semibold leading-6">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-extrabold uppercase text-[#F45D2C]">{sectionLabel}</p>
            <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-5xl">{content.sectionTitle}</h2>
            <p className="mt-5 text-base leading-7 text-[#5C5E66]">{content.sectionIntro}</p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-md border border-[#DDD7D3] bg-[#DDD7D3] sm:grid-cols-2 lg:grid-cols-3">
            {content.features.map((feature, index) => {
              const icons = [CreditCard, Webhook, ShieldCheck, Code2, QrCode, CheckCircle2];
              const Icon = icons[index % icons.length];
              return (
                <article key={feature.title} className="min-h-52 bg-white p-7">
                  <Icon className="h-6 w-6 text-[#F45D2C]" />
                  <h3 className="mt-8 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5C5E66]">{feature.description}</p>
                </article>
              );
            })}
          </div>
          {content.note && <p className="mt-6 rounded-md border border-[#F5B293] bg-[#FFF1E9] p-4 text-sm font-semibold text-[#8A321F]">{content.note}</p>}
        </div>
      </section>

      {content.faq && (
        <section className="border-t border-[#DDD7D3] bg-white">
          <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div><p className="text-xs font-extrabold uppercase text-[#F45D2C]">Questions fréquentes</p><h2 className="mt-4 text-3xl font-semibold sm:text-4xl">L’essentiel avant de commencer</h2></div>
            <div className="divide-y divide-[#DDD7D3] border-y border-[#DDD7D3]">
              {content.faq.map((item) => <details key={item.question} className="group py-5"><summary className="cursor-pointer list-none pr-8 text-sm font-bold marker:hidden">{item.question}</summary><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5C5E66]">{item.answer}</p></details>)}
            </div>
          </div>
        </section>
      )}

      <section className="border-y border-[#F5B293] bg-[#FBCDB1]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-8 px-5 py-16 sm:px-8 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-3xl font-semibold sm:text-4xl">{finalTitle}</h2>
            <p className="mt-3 max-w-2xl text-[#5C5E66]">{finalDescription}</p>
          </div>
          <Link href={finalHref} style={{ color: "#FFFFFF" }} className="kobara-cta inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#10131D] px-6 text-sm font-bold text-white">
            <span style={{ color: "#FFFFFF" }}>{finalLabel}</span><ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-[22rem] -top-[52rem] h-[72rem] w-[96rem] rounded-full bg-[#FDE9E3]/80" />
      <div className="absolute -bottom-[36rem] -left-[20rem] h-[52rem] w-[92rem] rounded-[50%] bg-[#E9EDF1]/90" />
    </div>
  );
}

function ContextVisual({ eyebrow }: { eyebrow: string }) {
  const isQr = eyebrow.includes("QR");
  const isInvoice = eyebrow.includes("Factures");

  if (isQr) {
    return (
      <div className="mx-auto grid w-full max-w-lg place-items-center rounded-md border border-[#DDD7D3] bg-white p-8 shadow-[0_24px_60px_rgba(16,19,29,0.12)]">
        <div className="grid h-52 w-52 place-items-center border-8 border-[#10131D] bg-white"><QrCode className="h-40 w-40" /></div>
        <p className="mt-7 text-sm font-bold">Scannez pour ouvrir le checkout Kobara</p>
      </div>
    );
  }

  if (isInvoice) {
    return (
      <div className="mx-auto w-full max-w-lg rounded-md border border-[#DDD7D3] bg-white p-7 shadow-[0_24px_60px_rgba(16,19,29,0.12)]">
        <div className="flex items-center justify-between border-b border-[#DDD7D3] pb-5"><strong>FACTURE KBR-2048</strong><span className="rounded bg-[#FFF1E9] px-2 py-1 text-xs font-bold text-[#E22F23]">À payer</span></div>
        <div className="space-y-4 py-7 text-sm"><div className="flex justify-between"><span className="text-[#5C5E66]">Service</span><strong>Intégration Pro</strong></div><div className="flex justify-between"><span className="text-[#5C5E66]">Montant</span><strong>2 500 HTG</strong></div></div>
        <button type="button" className="min-h-12 w-full rounded-md bg-[#F45D2C] font-bold text-white">Payer la facture</button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-md border border-[#DDD7D3] bg-white shadow-[0_24px_60px_rgba(16,19,29,0.12)]">
      <div className="flex items-center justify-between border-b border-[#DDD7D3] px-5 py-4">
        <div className="flex items-center gap-3"><Image src="/Icone.png" alt="" width={24} height={24} /><strong className="text-sm">Smartcore Academy</strong></div>
        <span className="flex items-center gap-1.5 text-xs text-[#5C5E66]"><ShieldCheck className="h-4 w-4 text-[#F45D2C]" />Sécurisé</span>
      </div>
      <div className="grid md:grid-cols-[1fr_180px]">
        <div className="p-5 sm:p-7">
          <p className="text-sm font-bold">Choisissez votre moyen de paiement</p>
          <div className="mt-5 divide-y divide-[#DDD7D3] border-y border-[#DDD7D3]">
            {["MonCash", "NatCash", "Crypto"].map((method, index) => (
              <div key={method} className="flex items-center justify-between py-4"><span className="flex items-center gap-3"><span className={`h-5 w-5 rounded-full border ${index === 0 ? "border-[6px] border-[#F45D2C]" : "border-[#9D9EA3]"}`} /><strong className="text-sm">{method}</strong></span>{index === 0 && <CircleCheck className="h-5 w-5 text-[#F45D2C]" />}</div>
            ))}
          </div>
          <button type="button" className="mt-5 min-h-12 w-full rounded-md bg-[#F45D2C] text-sm font-bold text-white">Continuer</button>
        </div>
        <aside className="hidden border-l border-[#DDD7D3] bg-[#FFF8F5] p-5 md:block"><p className="text-xs font-bold">Détails</p><p className="mt-8 text-3xl font-semibold">2 500 <span className="text-sm text-[#F45D2C]">HTG</span></p><div className="mt-7 border-t border-[#DDD7D3] pt-5 text-xs text-[#5C5E66]">Confirmation en temps réel</div></aside>
      </div>
    </div>
  );
}
