import Link from "next/link";
import { ArrowRight, Building2, Check, CreditCard, Smartphone } from "lucide-react";
import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";
import { getServerTranslation } from "@/lib/server/i18n";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";

export const metadata = { title: "Tarifs | Kobara", description: "Tarifs Kobara pour MonCash, NatCash, les cartes bancaires et les entreprises." };

export default async function PricingPage() {
  const { language } = await getServerTranslation();
  const fr = language === "fr";
  const config = await getPaymentProviderConfig();
  const format = new Intl.NumberFormat(fr ? "fr-FR" : "en-US", { maximumFractionDigits: 2 });
  const cardPrice = `${format.format(config.paypal_fee_percent)}% + ${format.format(config.paypal_fee_fixed_usd)} USD`;
  const localFeatures = fr ? ["Checkout Kobara", "Liens de paiement et QR codes", "API et confirmations par webhook"] : ["Kobara Checkout", "Payment links and QR codes", "API and webhook confirmations"];
  const cards = [
    { name: "MonCash", icon: Smartphone, dark: false, description: fr ? "Paiements mobiles en gourdes" : "Mobile payments in Haitian gourdes", price: fr ? "3,9%" : "3.9%", rate: true, features: localFeatures, href: "/register" },
    { name: "NatCash", icon: Smartphone, dark: false, description: fr ? "Paiements mobiles en gourdes" : "Mobile payments in Haitian gourdes", price: fr ? "3,9%" : "3.9%", rate: true, features: localFeatures, href: "/register" },
    { name: fr ? "Cartes bancaires" : "Card payments", icon: CreditCard, dark: true, description: fr ? "Selon disponibilité et activation du compte" : "Subject to availability and account activation", price: cardPrice, rate: false, features: fr ? ["Tarif par transaction réussie", "Règlement sur le compte USD", "Conditions selon le moyen activé"] : ["Per successful transaction", "Settlement to the USD account", "Terms depend on the enabled method"], href: "/contact" },
    { name: fr ? "Entreprise" : "Enterprise", icon: Building2, dark: false, description: fr ? "Pour vos volumes et besoins particuliers" : "For your volume and specific requirements", price: fr ? "Parlons de votre projet" : "Let's discuss your project", rate: false, features: fr ? ["Étude de vos besoins", "Échange sur vos volumes de paiement", "Accompagnement à l’intégration"] : ["Review of your requirements", "Discuss your payment volumes", "Integration guidance"], href: "/contact" },
  ];

  return (
    <main className="kobara-public min-h-[100dvh] bg-[#F4F6F8] font-sans text-[#10131D]">
      <PublicHeader />
      <section aria-labelledby="pricing-title" className="mx-auto max-w-[1280px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
          <h1 id="pricing-title" className="text-3xl font-extrabold leading-tight sm:text-4xl">{fr ? "Des tarifs adaptés à vos paiements." : "Pricing for the way you get paid."}</h1>
          <p className="mt-4 text-base leading-7 text-[#5C5E66]">{fr ? "Sans abonnement mensuel. Retrouvez le tarif de chaque moyen de paiement, par transaction réussie." : "No monthly subscription. Find the rate for each payment method, per successful transaction."}</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ name, icon: Icon, dark, description, price, rate, features, href }) => (
            <article key={name} className={`flex min-w-0 flex-col rounded-lg border p-6 sm:p-8 xl:p-6 ${dark ? "public-dark-panel border-[#10131D] bg-[#10131D] text-white" : "border-[#E2E5E9] bg-white text-[#10131D]"}`}>
              <span className={`mb-7 grid h-12 w-12 place-items-center rounded-lg ${dark ? "bg-white/10 text-white" : "bg-[#FFF0E8] text-[#E74E20]"}`}><Icon aria-hidden className="h-6 w-6" /></span>
              <h2 className="text-xl font-bold">{name}</h2>
              <p className={`mt-2 min-h-12 text-sm leading-6 ${dark ? "text-white/70" : "text-[#5C5E66]"}`}>{description}</p>
              <div className="mt-7 flex min-h-20 flex-col justify-center">
                <p className={rate ? "text-5xl font-extrabold leading-none" : "text-2xl font-bold leading-8"}>{price}</p>
                {rate && <p className="mt-2 text-sm text-[#5C5E66]">{fr ? "par transaction réussie" : "per successful transaction"}</p>}
              </div>
              <ul className="mb-8 mt-7 space-y-4 text-sm leading-6">
                {features.map(feature => <li key={feature} className="flex items-start gap-3"><span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${dark ? "bg-white/10 text-[#FFAB85]" : "bg-[#FFF0E8] text-[#C6411E]"}`}><Check aria-hidden className="h-3 w-3" /></span><span>{feature}</span></li>)}
              </ul>
              <Link href={href} className={`mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F45D2C] ${dark ? "kobara-cta border-[#F45D2C] bg-[#F45D2C] text-white hover:bg-[#D94318]" : "border-[#D7DCE2] bg-white text-[#10131D] hover:border-[#F45D2C] hover:bg-[#FFF7F2]"}`}>{href === "/register" ? (fr ? "Commencer" : "Get started") : (fr ? "Nous contacter" : "Contact us")}<ArrowRight aria-hidden className="h-4 w-4 shrink-0" /></Link>
            </article>
          ))}
        </div>
        <p className="mt-6 text-sm leading-6 text-[#5C5E66]">{fr ? "Les frais de retrait sont distincts des frais de paiement. Consultez les conditions applicables à votre compte avant toute opération." : "Withdrawal fees are separate from payment fees. Check the terms applicable to your account before making a transaction."} <Link href="/contact" className="font-semibold text-[#B83B19] underline underline-offset-4">{fr ? "Une question ?" : "Questions?"}</Link></p>
      </section>
      <Footer />
    </main>
  );
}
