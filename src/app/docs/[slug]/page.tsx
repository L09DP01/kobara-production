import { auth } from "@/auth";
import { DocsClient } from "../docs-client";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { DOC_SLUGS, getDocContent } from "@/content/docs/generated";

export const dynamicParams = false;

export function generateStaticParams() {
  return DOC_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await props.params;
  const titleMap: Record<string, string> = {
    'quickstart': 'API MonCash et API NatCash - Quickstart Kobara',
    'authentication': 'Authentification API MonCash et API NatCash',
    'api-keys': 'API Keys Management',
    'javascript-sdk': 'JavaScript SDK',
    'nodejs-sdk': 'Node.js SDK',
    'python-sdk': 'Python SDK',
    'php-sdk': 'PHP SDK',
    'wordpress-plugin': 'WordPress Plugin',
    'payments': 'API MonCash, MonCash API, API NatCash et NatCash API',
    'payment-links': 'Payment Links API',
    'webhooks': 'Webhooks Integration',
    'withdrawals': 'Withdrawals API',
    'errors': 'API Errors',
    'metadata': 'Metadata Expansion',
    'ai-integration': 'AI Integration'
  };

  const title = titleMap[resolvedParams.slug] || 'Documentation';
  return {
    title: `${title} | Kobara Docs`,
    description: `Documentation Kobara pour integrer une API MonCash, MonCash API, API NatCash ou NatCash API sur un site web, une application ou WooCommerce en Haiti.`,
    keywords: [
      "API MonCash",
      "MonCash API",
      "API NatCash",
      "NatCash API",
      `Kobara ${title}`,
      "Haiti Payment API",
    ]
  };
}

export default async function DocsDocPage(props: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const resolvedParams = await props.params;
  const { slug } = resolvedParams;
  const markdownContent = getDocContent(slug);

  if (!markdownContent) return notFound();

  return (
    <div className="min-h-[100dvh] bg-background">
      <DocsClient 
        isAuthenticated={isAuthenticated}
        markdownContent={markdownContent}
        currentSlug={slug}
      />
    </div>
  );
}
