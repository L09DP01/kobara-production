import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { TrustedBy } from "@/components/landing/TrustedBy";
import { SixWays } from "@/components/landing/SixWays";
import { PayButton } from "@/components/landing/PayButton";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ApiProcessing } from "@/components/landing/ApiProcessing";
import { CTA } from "@/components/landing/CTA";
import { Footer } from "@/components/landing/Footer";
import { siteConfig } from "@/config/site";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API MonCash et API NatCash Haiti - Passerelle Kobara",
  description: siteConfig.shortDescription,
  alternates: {
    canonical: siteConfig.url,
  },
  openGraph: {
    title: "Kobara - API MonCash, MonCash API, API NatCash et NatCash API",
    description: siteConfig.shortDescription,
    url: siteConfig.url,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "Kobara checkout MonCash NatCash Haiti",
      },
    ],
  },
};

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Kobara",
    url: siteConfig.url,
    logo: `${siteConfig.url}/Icone.png`,
    sameAs: [siteConfig.links.github, siteConfig.links.twitter],
    areaServed: {
      "@type": "Country",
      name: "Haiti",
    },
    knowsAbout: [
      "API MonCash",
      "MonCash API",
      "API NatCash",
      "NatCash API",
      "MonCash",
      "NatCash",
      "paiement en ligne Haiti",
      "API de paiement",
      "WooCommerce",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Kobara",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, Android, iOS",
    url: siteConfig.url,
    description: siteConfig.description,
    offers: {
      "@type": "Offer",
      priceCurrency: "HTG",
      availability: "https://schema.org/InStock",
    },
    featureList: [
      "Paiements MonCash",
      "Paiements NatCash",
      "Liens de paiement",
      "API de paiement",
      "Webhooks",
      "Plugin WooCommerce",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Kobara",
    url: siteConfig.url,
    inLanguage: ["fr-HT", "ht-HT", "en"],
    description: siteConfig.description,
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          background-color: #020B14 !important;
        }
      `}} />
      <main className="relative min-h-[100dvh] bg-[#020B14] selection:bg-[#FF4A1C] selection:text-white font-sans text-white">
      <Navbar />
      <Hero />
      <TrustedBy />
      <section className="relative bg-[#020B14] py-12 md:py-16 border-y border-[#1E2A38]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FF4A1C] mb-4">
            API MonCash et API NatCash en Haiti
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-5">
            Une passerelle locale pour les recherches MonCash API et NatCash API
          </h2>
          <p className="text-base md:text-lg leading-relaxed text-[#AAB3C2] max-w-3xl mx-auto">
            Kobara aide les marchands, boutiques WooCommerce, createurs, SaaS et applications mobiles en Haiti a recevoir des paiements rapidement avec une API MonCash, une API NatCash, des liens de paiement, des webhooks et un tableau de bord marchand.
          </p>
        </div>
      </section>
      <SixWays />
      <PayButton />
      <HowItWorks />
      <ApiProcessing />
      <CTA />
      <Footer />
    </main>
    </>
  );
}
