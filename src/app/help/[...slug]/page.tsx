import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpArticlePage } from "@/components/help/HelpArticlePage";
import { getHelpArticle, getHelpArticleHref, getHelpArticlesByCategory, getHelpCategory, helpCategories, publishedHelpArticles } from "@/lib/help-center-content";

type PageProps = { params: Promise<{ slug: string[] }> };

export function generateStaticParams() {
  return [
    ...helpCategories.map((category) => ({ slug: [category.slug] })),
    ...publishedHelpArticles.map((item) => ({ slug: item.path.split("/") })),
  ];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const path = slug.join("/");
  const article = getHelpArticle(path);
  if (article) return { title: article.title, description: article.description, alternates: { canonical: `https://help.kobara.app/${article.path}` } };
  const category = slug.length === 1 ? getHelpCategory(slug[0]) : undefined;
  if (category) return { title: category.name, description: category.description, alternates: { canonical: `https://help.kobara.app/${category.slug}` } };
  return {};
}

export default async function HelpCatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const path = slug.join("/");
  const article = getHelpArticle(path);
  if (article) {
    const jsonLd = { "@context": "https://schema.org", "@type": "TechArticle", headline: article.title, description: article.description, dateModified: article.lastUpdatedAt, inLanguage: "fr", author: { "@type": "Organization", name: "Kobara" }, mainEntityOfPage: `https://help.kobara.app/${article.path}` };
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><HelpArticlePage article={article} /></>;
  }

  const category = slug.length === 1 ? getHelpCategory(slug[0]) : undefined;
  if (!category) notFound();
  const articles = getHelpArticlesByCategory(category.slug);

  return (
    <main className="min-h-[70vh] bg-[#FCFAF8] text-[#10131D]">
      <section className="border-b border-[#E3DEDA] bg-[#FCF7F4]">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <nav className="text-sm text-[#696B72]"><Link href="/help" className="font-semibold hover:text-[#F45D2C]">Centre d’aide</Link> <span className="mx-2">/</span> {category.name}</nav>
          <h1 className="mt-7 text-4xl font-extrabold sm:text-5xl">{category.name}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#5C5E66]">{category.description}</p>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        {articles.length ? <div className="divide-y divide-[#E3DEDA] border-y border-[#E3DEDA]">{articles.map((item) => <Link key={item.id} href={getHelpArticleHref(item)} className="group flex items-start justify-between gap-6 py-6"><span><span className="text-lg font-extrabold text-[#10131D] group-hover:text-[#C93D18]">{item.title}</span><span className="mt-2 block max-w-3xl leading-7 text-[#5C5E66]">{item.description}</span></span><ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[#9D9EA3] transition-transform group-hover:translate-x-1 group-hover:text-[#F45D2C]" /></Link>)}</div> : <div className="border-y border-[#E3DEDA] py-12"><p className="font-bold">Les articles de cette catégorie arrivent bientôt.</p><p className="mt-2 text-[#5C5E66]">La phase 1 publie d’abord les réponses les plus demandées.</p></div>}
      </section>
    </main>
  );
}
