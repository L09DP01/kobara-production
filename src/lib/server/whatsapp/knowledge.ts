import 'server-only';

import { DOC_SLUGS, getDocContent } from '@/content/docs/generated';
import { helpArticles } from '@/lib/help-center-content';
import { developerPages, productPages, resourcePages, solutionPages } from '@/lib/public-site-content';

export type KnowledgeReference = {
  title: string;
  url: string;
  excerpt: string;
  score: number;
  kind: 'help' | 'docs' | 'public' | 'legal';
};

type KnowledgeDocument = Omit<KnowledgeReference, 'score'> & { searchText: string };

function cleanText(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value: string) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function pageText(page: (typeof productPages)[string]) {
  return [
    page.eyebrow,
    page.title,
    page.description,
    page.sectionTitle,
    page.sectionIntro,
    ...page.features.flatMap((item) => [item.title, item.description]),
    ...(page.flow || []),
    ...(page.details || []).flatMap((item) => [item.kicker, item.title, item.description, ...item.bullets]),
    ...(page.faq || []).flatMap((item) => [item.question, item.answer]),
    page.note || '',
  ].join(' ');
}

const helpDocuments: KnowledgeDocument[] = helpArticles
  .filter((article) => article.published)
  .map((article) => {
    const body = [
      article.title,
      article.description,
      article.summary,
      ...article.keywords,
      ...article.sections.flatMap((section) => [
        section.title,
        ...(section.paragraphs || []),
        ...(section.bullets || []),
        ...(section.steps || []),
        section.example || '',
        section.notice || '',
      ]),
    ].join(' ');
    return {
      title: article.title,
      url: `https://help.kobara.app/help/${article.path}`,
      excerpt: cleanText(`${article.summary} ${body}`).slice(0, 1800),
      searchText: normalize(body),
      kind: 'help' as const,
    };
  });

const docsDocuments: KnowledgeDocument[] = DOC_SLUGS.flatMap((slug) => {
  const content = getDocContent(slug);
  if (!content) return [];
  const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || String(slug);
  return [{
    title,
    url: `https://docs.kobara.app/docs/${slug}`,
    excerpt: cleanText(content).slice(0, 2200),
    searchText: normalize(content),
    kind: 'docs' as const,
  }];
});

const publicGroups = [
  ['products', productPages],
  ['solutions', solutionPages],
  ['developers', developerPages],
  ['resources', resourcePages],
] as const;

const publicDocuments: KnowledgeDocument[] = publicGroups.flatMap(([prefix, pages]) =>
  Object.entries(pages).map(([slug, page]) => {
    const body = pageText(page);
    return {
      title: page.title,
      url: `https://kobara.app/${prefix}/${slug}`,
      excerpt: cleanText(body).slice(0, 1800),
      searchText: normalize(body),
      kind: 'public' as const,
    };
  }),
);

const legalDocuments: KnowledgeDocument[] = [
  {
    title: 'Politique de confidentialité Kobara',
    url: 'https://kobara.app/privacy',
    excerpt: 'Kobara décrit les données de compte, KYC, transaction et sécurité collectées pour fournir et protéger le service. La politique explique les finalités, le partage limité avec les opérateurs et prestataires nécessaires, les durées de conservation, les droits des utilisateurs et les moyens de contacter Kobara. Kobara indique ne pas vendre les données à des fins publicitaires.',
    searchText: normalize('confidentialité vie privée données personnelles KYC transaction sécurité conservation partage cookies droits suppression accès rectification'),
    kind: 'legal',
  },
  {
    title: "Conditions générales d'utilisation Kobara",
    url: 'https://kobara.app/terms',
    excerpt: "Les conditions définissent Kobara comme une passerelle technologique de paiement, et non une banque. Elles couvrent l'éligibilité et la vérification, l'utilisation sécurisée de l'API, les paiements, les frais, les retraits, les activités interdites, la responsabilité du marchand et la protection des clés API.",
    searchText: normalize('conditions utilisation CGU légal banque passerelle technologie API paiement frais retrait responsabilité marchand interdit conformité'),
    kind: 'legal',
  },
];

const documents = [...helpDocuments, ...docsDocuments, ...publicDocuments, ...legalDocuments];
const stopWords = new Set(['avec', 'dans', 'pour', 'quoi', 'comment', 'the', 'and', 'that', 'this', 'yon', 'pou', 'nan', 'kijan', 'mwen', 'vous', 'votre', 'kobara']);

export function searchKobaraKnowledge(query: string, limit = 5): KnowledgeReference[] {
  const normalizedQuery = normalize(query);
  const tokens = [...new Set(normalizedQuery.split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopWords.has(token)))];

  return documents
    .map((document) => {
      let score = normalizedQuery.length > 7 && document.searchText.includes(normalizedQuery) ? 30 : 0;
      for (const token of tokens) {
        const occurrences = document.searchText.split(token).length - 1;
        score += Math.min(occurrences, 5) * (token.length >= 7 ? 4 : 2);
        if (normalize(document.title).includes(token)) score += 7;
      }
      if (document.kind === 'help') score += 1;
      return { ...document, score };
    })
    .filter((document) => document.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ searchText: _searchText, ...document }) => document);
}

export function formatKnowledgeContext(references: KnowledgeReference[]) {
  return references
    .map((reference, index) => `[SOURCE ${index + 1}] ${reference.title}\nURL: ${reference.url}\n${reference.excerpt}`)
    .join('\n\n');
}
