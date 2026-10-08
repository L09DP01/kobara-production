import Link from "next/link";
import { ArrowRight, Check, CircleHelp, Code2, CreditCard, ShieldCheck, WalletCards } from "lucide-react";

import { Footer } from "@/components/landing/Footer";
import { PublicHeader } from "@/components/marketing/PublicNavigation";
import { getServerTranslation } from "@/lib/server/i18n";

import { PricingClient, type PricingPlan } from "./PricingClient";

export async function generateMetadata() {
  const { t } = await getServerTranslation();
  return {
    title: `${t("nav.pricing")} — Kobara`,
    description: "Plans simples et transparents pour chaque étape de votre croissance. Commencez gratuitement. / Simple and transparent plans for every stage of your growth. Start for free.",
  };
}

export default async function PricingPage() {
  const { language } = await getServerTranslation();
  const isFrench = language === "fr";

  const plans: PricingPlan[] = [
    {
      name: "Free",
      price: null,
      priceLabel: isFrench ? "Gratuit" : "Free",
      period: null,
      description: isFrench ? "Pour tester Kobara et lancer votre premier flux de paiement." : "For testing Kobara and launching your first payment flow.",
      highlight: false,
      badge: null,
      features: isFrench
        ? ["1 clé API", "Plugin WordPress inclus", "10 paiements / mois", "4% de frais par transaction*", "Retrait jusqu’à 2 500 HTG / jour", "Dashboard de base", "Support communauté"]
        : ["1 API key", "WordPress plugin included", "10 payments / month", "4% fee per transaction*", "Withdrawal up to 2,500 HTG / day", "Basic dashboard", "Community support"],
      cta: isFrench ? "Commencer gratuitement" : "Start for free",
      ctaHref: "/register",
      feeNote: isFrench ? "* Inclut les frais Kobara et les frais de traitement MonCash/NatCash." : "* Includes Kobara and MonCash/NatCash processing fees.",
    },
    {
      name: "Pro",
      price: 1750,
      priceLabel: "1 750",
      period: isFrench ? "HTG / mois" : "HTG / month",
      description: isFrench ? "Pour les marchands qui encaissent régulièrement et veulent automatiser." : "For merchants collecting regularly who want to automate.",
      highlight: false,
      badge: null,
      features: isFrench
        ? ["Clés API illimitées", "Plugin WordPress inclus", "Paiements illimités", "2,9% de frais par transaction", "Retrait jusqu’à 20 000 HTG / jour", "Webhooks avancés", "Support email prioritaire"]
        : ["Unlimited API keys", "WordPress plugin included", "Unlimited payments", "2.9% fee per transaction", "Withdrawal up to 20,000 HTG / day", "Advanced webhooks", "Priority email support"],
      cta: isFrench ? "Choisir Pro" : "Choose Pro",
      ctaHref: "/register?plan=pro",
      feeNote: null,
    },
    {
      name: "Premium",
      price: 5000,
      priceLabel: "5 000",
      period: isFrench ? "HTG / mois" : "HTG / month",
      description: isFrench ? "Pour les entreprises qui pilotent un volume élevé avec plus de contrôle." : "For businesses managing higher volume with more control.",
      highlight: true,
      badge: isFrench ? "Recommandé" : "Recommended",
      features: isFrench
        ? ["Clés API illimitées", "Plugin WordPress inclus", "Paiements illimités", "2,9% de frais par transaction", "Retrait jusqu’à 50 000 HTG / jour", "Webhooks et logs avancés", "Analyses et rapports", "Support email et chat"]
        : ["Unlimited API keys", "WordPress plugin included", "Unlimited payments", "2.9% fee per transaction", "Withdrawal up to 50,000 HTG / day", "Advanced webhooks and logs", "Analytics and reports", "Email and chat support"],
      cta: isFrench ? "Choisir Premium" : "Choose Premium",
      ctaHref: "/register?plan=premium",
      feeNote: null,
    },
    {
      name: "Business",
      price: 12500,
      priceLabel: "12 500",
      period: isFrench ? "HTG / mois" : "HTG / month",
      description: isFrench ? "Pour les organisations qui demandent accompagnement, SLA et intégration dédiée." : "For organizations requiring guidance, SLA, and dedicated integration.",
      highlight: false,
      badge: isFrench ? "Entreprise" : "Enterprise",
      features: isFrench
        ? ["Tout Premium inclus", "Clés API et paiements illimités", "2,9% de frais par transaction", "Retraits illimités", "Intégration personnalisée", "SLA garanti 99,9%", "Gestionnaire de compte dédié", "Support prioritaire 24/7"]
        : ["Everything in Premium", "Unlimited API keys and payments", "2.9% fee per transaction", "Unlimited withdrawals", "Custom integration", "99.9% guaranteed SLA", "Dedicated account manager", "24/7 priority support"],
      cta: isFrench ? "Contacter l’équipe" : "Contact sales",
      ctaHref: "/contact",
      feeNote: null,
    },
  ];

  const comparison = [
    { label: isFrench ? "Prix mensuel" : "Monthly price", values: [isFrench ? "Gratuit" : "Free", "1 750 HTG", "5 000 HTG", "12 500 HTG"] },
    { label: isFrench ? "Frais par transaction" : "Transaction fee", values: ["4%", "2,9%", "2,9%", "2,9%"] },
    { label: isFrench ? "Clés API" : "API keys", values: ["1", isFrench ? "Illimitées" : "Unlimited", isFrench ? "Illimitées" : "Unlimited", isFrench ? "Illimitées" : "Unlimited"] },
    { label: isFrench ? "Paiements mensuels" : "Monthly payments", values: ["10", isFrench ? "Illimités" : "Unlimited", isFrench ? "Illimités" : "Unlimited", isFrench ? "Illimités" : "Unlimited"] },
    { label: isFrench ? "Retrait journalier" : "Daily withdrawal", values: ["2 500 HTG", "20 000 HTG", "50 000 HTG", isFrench ? "Illimité" : "Unlimited"] },
    { label: "Webhooks", values: [false, true, true, true] },
    { label: isFrench ? "Analyses avancées" : "Advanced analytics", values: [false, false, true, true] },
    { label: isFrench ? "Support" : "Support", values: [isFrench ? "Communauté" : "Community", "Email", "Email + chat", "24/7"] },
    { label: "SLA 99,9%", values: [false, false, false, true] },
  ];

  const faqItems = [
    {
      question: isFrench ? "Comment les frais de transaction sont-ils calculés ?" : "How are transaction fees calculated?",
      answer: isFrench ? "Les frais sont automatiquement déduits de chaque paiement confirmé. Pour 1 000 HTG reçus, le plan Free crédite 960 HTG et un plan payant crédite 971 HTG." : "Fees are automatically deducted from each confirmed payment. For 1,000 HTG received, Free credits 960 HTG and a paid plan credits 971 HTG.",
    },
    {
      question: isFrench ? "Que couvrent les 4% du plan Free ?" : "What does the 4% Free fee cover?",
      answer: isFrench ? "Ils incluent les frais de la plateforme Kobara et les frais d’infrastructure de traitement MonCash/NatCash. Les plans payants profitent d’un taux réduit à 2,9%." : "They include Kobara platform and MonCash/NatCash processing infrastructure fees. Paid plans receive the reduced 2.9% rate.",
    },
    {
      question: isFrench ? "Quand mon solde devient-il disponible ?" : "When does my balance become available?",
      answer: isFrench ? "Votre solde est mis à jour après confirmation du paiement. Vous pouvez demander un retrait selon la limite journalière de votre plan." : "Your balance updates after payment confirmation. You can request a withdrawal within your plan’s daily limit.",
    },
    {
      question: isFrench ? "Puis-je changer de plan ?" : "Can I change plans?",
      answer: isFrench ? "Oui. Vous pouvez passer à un plan supérieur ou inférieur depuis votre dashboard. Le nouveau niveau d’accès prend effet immédiatement." : "Yes. You can upgrade or downgrade from your dashboard. Your new access level takes effect immediately.",
    },
    {
      question: isFrench ? "Y a-t-il des frais cachés ?" : "Are there hidden fees?",
      answer: isFrench ? "Non. Vous payez le prix mensuel affiché et les frais de transaction correspondant à votre plan." : "No. You pay the displayed monthly price and the transaction fee for your plan.",
    },
  ];

  const assurances = [
    { icon: CreditCard, title: isFrench ? "Paiements locaux" : "Local payments", text: "MonCash et NatCash" },
    { icon: Code2, title: "API & Webhooks", text: isFrench ? "Testez avant la production" : "Test before production" },
    { icon: ShieldCheck, title: isFrench ? "Contrôle du compte" : "Account control", text: isFrench ? "KYC, rôles et journaux" : "KYC, roles, and logs" },
    { icon: WalletCards, title: isFrench ? "Retraits adaptés" : "Flexible withdrawals", text: isFrench ? "Limites selon le plan" : "Limits based on plan" },
  ];

  return (
    <main className="kobara-public min-h-[100dvh] bg-[#FCF7F4] font-sans text-[#10131D] selection:bg-[#F45D2C] selection:text-white">
      <PublicHeader />

      <PricingClient language={language} plans={plans} />

      <section aria-label={isFrench ? "Inclus avec Kobara" : "Included with Kobara"} className="border-b border-[#DDD7D3] bg-white">
        <div className="mx-auto grid max-w-[1240px] sm:grid-cols-2 lg:grid-cols-4">
          {assurances.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-4 border-b border-r border-[#DDD7D3] px-5 py-6 sm:px-7">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-[#FFF1E9] text-[#F45D2C]"><Icon className="h-5 w-5" /></span>
              <span><strong className="block text-sm text-[#10131D]">{title}</strong><span className="mt-1 block text-xs text-[#5C5E66]">{text}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[#DDD7D3] py-16 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-5 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-[#F45D2C]">{isFrench ? "Comparaison" : "Comparison"}</p>
            <h2 className="mt-2 text-3xl font-extrabold text-[#10131D] sm:text-4xl">{isFrench ? "Comparez les plans en détail." : "Compare plans in detail."}</h2>
            <p className="mt-3 text-base leading-7 text-[#5C5E66]">{isFrench ? "Retrouvez les limites et fonctionnalités essentielles avant de faire votre choix." : "Review the essential limits and features before choosing."}</p>
          </div>

          <div className="mt-10 overflow-x-auto rounded-md border border-[#DDD7D3] bg-white">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#F7F3F0]">
                  <th scope="col" className="sticky left-0 z-10 w-[230px] border-b border-r border-[#DDD7D3] bg-[#F7F3F0] px-5 py-5 text-left font-bold text-[#5C5E66]">{isFrench ? "Fonctionnalité" : "Feature"}</th>
                  {plans.map((plan) => <th scope="col" key={plan.name} className={`border-b border-[#DDD7D3] px-5 py-5 text-center font-extrabold ${plan.highlight ? "text-[#F45D2C]" : "text-[#10131D]"}`}>{plan.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-[#E8E3DF] last:border-b-0">
                    <th scope="row" className="sticky left-0 z-10 border-r border-[#E8E3DF] bg-white px-5 py-4 text-left font-semibold text-[#333847]">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-${plans[index].name}`} className={`px-5 py-4 text-center ${index === 2 ? "bg-[#FFF8F4]" : ""}`}>
                        {typeof value === "boolean" ? (value ? <Check className="mx-auto h-5 w-5 text-[#39715B]" /> : <span className="text-[#B5B0AD]">—</span>) : <span className="font-medium text-[#5C5E66]">{value}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-b border-[#DDD7D3] bg-white py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16">
          <div>
            <span className="grid h-11 w-11 place-items-center rounded-md bg-[#FFF1E9] text-[#F45D2C]"><CircleHelp className="h-5 w-5" /></span>
            <h2 className="mt-5 text-3xl font-extrabold text-[#10131D]">{isFrench ? "Questions fréquentes" : "Frequently asked questions"}</h2>
            <p className="mt-3 leading-7 text-[#5C5E66]">{isFrench ? "Une question sur votre cas particulier ? Notre équipe peut vous aider à choisir." : "Have a question about your specific case? Our team can help you choose."}</p>
            <Link href="/contact" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#C64120] hover:text-[#E22F23]">{isFrench ? "Parler à notre équipe" : "Talk to our team"}<ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="divide-y divide-[#DDD7D3] border-y border-[#DDD7D3]">
            {faqItems.map((item, index) => (
              <details key={item.question} className="group py-1" open={index === 0}>
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 font-bold text-[#10131D] marker:hidden">
                  {item.question}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#D8D3CF] text-lg font-normal text-[#F45D2C] group-open:rotate-45">+</span>
                </summary>
                <p className="max-w-2xl pb-6 pr-10 text-sm leading-7 text-[#5C5E66]">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="public-dark-panel bg-[#10131D] py-16 text-white sm:py-20">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-[#FC9A65]">{isFrench ? "Prêt à commencer ?" : "Ready to start?"}</p>
            <h2 className="mt-3 text-3xl font-extrabold text-white sm:text-4xl">{isFrench ? "Acceptez votre premier paiement avec Kobara." : "Accept your first payment with Kobara."}</h2>
            <p className="mt-3 leading-7 text-white/65">{isFrench ? "Créez gratuitement votre compte et configurez vos premiers moyens de paiement." : "Create your account for free and configure your first payment methods."}</p>
          </div>
          <Link href="/register" className="kobara-cta inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-[#F45D2C] px-6 text-sm font-extrabold text-white hover:bg-[#E22F23]">{isFrench ? "Créer un compte" : "Create an account"}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
