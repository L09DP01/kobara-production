import type { Metadata } from "next";

import { LandingPageV2 } from "@/components/landing/LandingPageV2";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "API MonCash et API NatCash Haiti - Passerelle Kobara",
  description: siteConfig.shortDescription,
  alternates: { canonical: siteConfig.url },
  openGraph: {
    title: "Kobara - API MonCash, MonCash API, API NatCash et NatCash API",
    description: siteConfig.shortDescription,
    url: siteConfig.url,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: "Kobara checkout MonCash NatCash Haiti" }],
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
    areaServed: { "@type": "Country", name: "Haiti" },
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
    featureList: ["Paiements MonCash", "Paiements NatCash", "Liens de paiement", "API de paiement", "Webhooks", "Plugin WooCommerce"],
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }} />
      <LandingPageV2 />
    </>
  );
}
