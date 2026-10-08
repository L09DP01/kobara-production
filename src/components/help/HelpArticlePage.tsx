import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, CircleHelp, Info, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { ArticleFeedback } from "@/components/help/ArticleFeedback";
import { getHelpArticle, getHelpArticleHref, getHelpCategory, type HelpArticle } from "@/lib/help-center-content";

const statusLabels = {
  available: "Disponible",
  beta: "Bêta",
  coming_soon: "Bientôt",
  unavailable: "Non disponible",
};

function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "success"; children: React.ReactNode }) {
  const Icon = tone === "warning" ? AlertTriangle : tone === "success" ? CheckCircle2 : Info;
  const styles = tone === "warning" ? "border-[#F2C8BA] bg-[#FFF4F0] text-[#6C2D18]" : tone === "success" ? "border-[#BEE4D4] bg-[#EFFAF5] text-[#145A43]" : "border-[#CAD8E8] bg-[#F3F7FB] text-[#293E59]";
  return <div className={`mt-5 flex gap-3 rounded-md border p-4 text-sm leading-6 ${styles}`}><Icon className="mt-0.5 h-5 w-5 shrink-0" /><p>{children}</p></div>;
}

export function HelpArticlePage({ article }: { article: HelpArticle }) {
  const category = getHelpCategory(article.category);
  const related = article.relatedArticles.map(getHelpArticle).filter((item): item is HelpArticle => Boolean(item));

  return (
    <main className="bg-[#FCFAF8] text-[#10131D]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-[#696B72]" aria-label="Fil d’Ariane">
          <Link href="/help" className="font-semibold hover:text-[#F45D2C]">Centre d’aide</Link><span>/</span>
          <Link href={`/help/${article.category}`} className="font-semibold hover:text-[#F45D2C]">{category?.name ?? article.category}</Link><span>/</span>
          <span className="text-[#333847]">{article.title}</span>
        </nav>

        <div className="mt-9 grid gap-12 lg:grid-cols-[minmax(0,760px)_260px] lg:justify-between">
          <article>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#FFE7DC] px-3 py-1 text-xs font-extrabold uppercase text-[#C93D18]">{category?.name}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${article.productStatus === "unavailable" ? "bg-[#F1F1F2] text-[#5C5E66]" : "bg-[#E9F8F1] text-[#087A55]"}`}>{statusLabels[article.productStatus]}</span>
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.08] text-[#10131D] sm:text-5xl">{article.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#4F5159]">{article.summary}</p>

            <div className="mt-10 border-t border-[#E3DEDA]">
              {article.sections.map((section) => (
                <section key={section.title} className="border-b border-[#E3DEDA] py-8">
                  <h2 className="text-2xl font-extrabold text-[#10131D]">{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph} className="mt-4 text-base leading-7 text-[#45474F]">{paragraph}</p>)}
                  {section.bullets ? <ul className="mt-5 space-y-3">{section.bullets.map((item) => <li key={item} className="flex gap-3 leading-7 text-[#45474F]"><CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#F45D2C]" /><span>{item}</span></li>)}</ul> : null}
                  {section.steps ? <ol className="mt-5 space-y-4">{section.steps.map((item, index) => <li key={item} className="flex gap-4 leading-7 text-[#45474F]"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#F5B293] bg-[#FFF4EF] text-xs font-extrabold text-[#C93D18]">{index + 1}</span><span>{item}</span></li>)}</ol> : null}
                  {section.example ? <div className="mt-5 border-l-2 border-[#F45D2C] bg-white px-5 py-4 font-mono text-sm leading-6 text-[#333847]">{section.example}</div> : null}
                  {section.notice ? <Notice tone={section.noticeTone}>{section.notice}</Notice> : null}
                </section>
              ))}
            </div>

            {article.developerDocUrl ? (
              <a href={article.developerDocUrl} className="mt-8 flex items-center justify-between gap-4 rounded-md border border-[#D8D3CF] bg-white p-5 hover:border-[#F45D2C]" target="_blank" rel="noreferrer">
                <span className="flex items-start gap-3"><BookOpen className="mt-0.5 h-5 w-5 text-[#F45D2C]" /><span><strong className="block">Documentation développeur</strong><span className="mt-1 block text-sm text-[#5C5E66]">Consultez les endpoints et exemples d’intégration.</span></span></span>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </a>
            ) : null}

            {article.sources?.length ? (
              <section className="mt-8">
                <h2 className="text-lg font-extrabold">Sources officielles consultées</h2>
                <ul className="mt-3 space-y-2 text-sm">{article.sources.map((source) => <li key={source.url}><a className="font-semibold text-[#C93D18] underline decoration-[#F5B293] underline-offset-4" href={source.url} target="_blank" rel="noreferrer">{source.label}</a></li>)}</ul>
              </section>
            ) : null}

            {related.length ? (
              <section className="mt-10">
                <h2 className="text-xl font-extrabold">Articles associés</h2>
                <div className="mt-4 divide-y divide-[#E3DEDA] border-y border-[#E3DEDA]">{related.map((item) => <Link key={item.id} href={getHelpArticleHref(item)} className="group flex min-h-14 items-center justify-between gap-4 py-3 font-semibold text-[#333847] hover:text-[#E34A1F]"><span>{item.title}</span><ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-1" /></Link>)}</div>
              </section>
            ) : null}

            <ArticleFeedback articleId={article.id} />
          </article>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="border-l-2 border-[#F45D2C] pl-5">
              <p className="text-xs font-extrabold uppercase text-[#777981]">Dans cet article</p>
              <ul className="mt-4 space-y-3 text-sm">{article.sections.map((section) => <li key={section.title} className="leading-5 text-[#4F5159]">{section.title}</li>)}</ul>
            </div>
            <div className="mt-8 rounded-md bg-[#10131D] p-5 text-white">
              <LifeBuoy className="h-5 w-5 text-[#FC9A65]" />
              <p className="mt-3 font-bold">Besoin d’aide ?</p>
              <p className="mt-2 text-sm leading-6 text-white/70">Envoyez la référence concernée au support. Ne partagez jamais vos secrets.</p>
              <Link href="/contact" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#FC9A65]">Contacter Kobara <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-5 flex gap-2 text-xs leading-5 text-[#777981]"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0" /><span>Dernière vérification : {article.lastReviewedAt}</span></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
