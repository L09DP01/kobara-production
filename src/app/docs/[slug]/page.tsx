import { auth } from "@/auth";
import { DocsClient } from "../docs-client";
import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { Metadata } from "next";

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

  let markdownContent = "";
  try {
    const filePath = path.join(process.cwd(), "src", "content", "docs", `${slug}.md`);
    if (!fs.existsSync(filePath)) {
      return notFound();
    }
    markdownContent = fs.readFileSync(filePath, "utf8");
  } catch (error) {
    console.error("Could not read docs file", error);
    return notFound();
  }

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
