import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingDetailPage } from "@/components/marketing/MarketingDetailPage";
import type { ProductHeroKind } from "@/components/marketing/ProductHeroVisual";
import { developerPages } from "@/lib/public-site-content";

export function generateStaticParams() {
  return Object.keys(developerPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = developerPages[slug];
  if (!content) return {};
  return {
    title: `${content.title} — Kobara`,
    description: content.description,
  };
}

export default async function DveloppeursPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = developerPages[slug];
  if (!content) notFound();
  const productKind: ProductHeroKind | undefined = slug === "sdks" ? "sdk" : undefined;
  return <MarketingDetailPage content={content} productKind={productKind} />;
}
