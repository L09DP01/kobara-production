import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingDetailPage } from "@/components/marketing/MarketingDetailPage";
import type { ProductHeroKind } from "@/components/marketing/ProductHeroVisual";
import { productPages } from "@/lib/public-site-content";

const animatedProducts: ProductHeroKind[] = ["payments", "checkout", "payment-links", "qr-codes", "invoices", "payment-methods"];

export function generateStaticParams() {
  return Object.keys(productPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = productPages[slug];
  if (!content) return {};
  return {
    title: `${content.title} — Kobara`,
    description: content.description,
  };
}

export default async function ProduitsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = productPages[slug];
  if (!content) notFound();
  const productKind = animatedProducts.includes(slug as ProductHeroKind) ? slug as ProductHeroKind : undefined;
  return <MarketingDetailPage content={content} productKind={productKind} />;
}
