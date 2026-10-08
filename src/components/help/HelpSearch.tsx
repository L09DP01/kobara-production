"use client";

import { ArrowRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type SearchArticle = {
  path: string;
  title: string;
  description: string;
  categoryName: string;
  keywords: string[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function HelpSearch({ articles }: { articles: SearchArticle[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalize(query.trim());
  const results = useMemo(() => {
    if (normalizedQuery.length < 2) return [];
    return articles
      .map((item) => {
        const title = normalize(item.title);
        const haystack = normalize(`${item.title} ${item.description} ${item.categoryName} ${item.keywords.join(" ")}`);
        const score = title.startsWith(normalizedQuery) ? 3 : title.includes(normalizedQuery) ? 2 : haystack.includes(normalizedQuery) ? 1 : 0;
        return { item, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((result) => result.item);
  }, [articles, normalizedQuery]);

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <Search className="pointer-events-none absolute left-5 top-5 h-5 w-5 text-[#73757D]" aria-hidden />
      <input
        type="text"
        inputMode="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Paiement, retrait, vérification…"
        aria-label="Rechercher dans le Centre d’aide Kobara"
        className="h-16 w-full rounded-lg border border-[#CFC9C5] bg-white pl-14 pr-14 text-base text-[#10131D] shadow-[0_14px_40px_rgba(16,19,29,0.08)] outline-none placeholder:text-[#777981] focus:border-[#F45D2C] focus:ring-4 focus:ring-[#F45D2C]/10 sm:text-lg"
      />
      {query ? (
        <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-md text-[#5C5E66] hover:bg-[#F7F3F1]" aria-label="Effacer la recherche">
          <X className="h-5 w-5" />
        </button>
      ) : null}

      {normalizedQuery.length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-lg border border-[#D8D3CF] bg-white text-left shadow-[0_22px_60px_rgba(16,19,29,0.16)]">
          {results.length ? (
            <ul className="max-h-[420px] overflow-y-auto p-2">
              {results.map((item) => (
                <li key={item.path}>
                  <Link href={`/help/${item.path}`} className="group flex items-start justify-between gap-4 rounded-md px-4 py-3 hover:bg-[#FCF7F4]">
                    <span>
                      <span className="block text-xs font-bold uppercase text-[#F45D2C]">{item.categoryName}</span>
                      <span className="mt-1 block font-bold text-[#10131D]">{item.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#5C5E66]">{item.description}</span>
                    </span>
                    <ArrowRight className="mt-5 h-4 w-4 shrink-0 text-[#9D9EA3] transition-transform group-hover:translate-x-1 group-hover:text-[#F45D2C]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-6">
              <p className="font-bold text-[#10131D]">Aucun article trouvé</p>
              <p className="mt-1 text-sm text-[#5C5E66]">Essayez un terme plus court ou contactez le support.</p>
              <Link href="/contact" className="mt-4 inline-flex min-h-10 items-center font-bold text-[#E34A1F]">Contacter Kobara <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
