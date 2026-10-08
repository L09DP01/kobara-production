import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingDetailPage } from "@/components/marketing/MarketingDetailPage";
import { paymentMethodPages } from "@/lib/public-site-content";

export function generateStaticParams() {
  return Object.keys(paymentMethodPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const content = paymentMethodPages[slug];
  if (!content) return {};
  return {
    title: `${content.title} — Kobara`,
    description: content.description,
  };
}

export default async function MoyensdepaiementPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const content = paymentMethodPages[slug];
  if (!content) notFound();
  return <MarketingDetailPage content={content} />;
}
