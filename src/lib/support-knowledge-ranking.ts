export const normalizeKnowledgeText = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const stopWords = new Set('avec dans pour quoi comment the and that this yon pou nan kijan mwen vous votre kobara les des une est que qui sur par aux son ses sont notre nos nous leurs leur cette ces afin ainsi plus peut peuvent possible permettre souhaite souhaitons merci monsieur madame voudrais pourriez votre'.split(' '));

export function knowledgeTokens(text: string) {
  return [...new Set(normalizeKnowledgeText(text).split(/[^a-z0-9]+/).filter((token) => token.length > 2 && !stopWords.has(token)))];
}

export function rankKnowledgeDocuments<T extends { title: string; searchText: string }>(documents: T[], query: string, limit: number) {
  const tokens = knowledgeTokens(query);
  const frequencies = new Map(tokens.map((token) => [token, documents.filter((document) => document.searchText.includes(token)).length]));
  return documents.map((document) => {
    const title = normalizeKnowledgeText(document.title);
    const score = tokens.reduce((total, token) => {
      if (!document.searchText.includes(token)) return total;
      const weight = Math.log(1 + documents.length / (1 + (frequencies.get(token) || 0)));
      // Presence and topic-specific titles matter more than repetition in a long reference page.
      return total + weight * (title.includes(token) ? 4 : 1);
    }, 0);
    return { ...document, score };
  }).filter((document) => document.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function knowledgeSearchQueries(query: string) {
  const text = normalizeKnowledgeText(query);
  if (!/marketplace|multi.vendeur|multi.vendor/.test(text)) {
    return /frais|tarif|fees|pricing/.test(text) ? ['tarifs tarification paiements frais', query] : [query];
  }
  const queries = ['marketplace ledger commissions'];
  if (/versement|retrait|redistribution|payout|withdraw|redistrib|beneficiaire/.test(text)) queries.push('retraits API withdrawals statut beneficiaire');
  if (/commission|repartition|split/.test(text)) queries.push('marketplace split commissions ledger');
  if (/condition|conformite|reglement|tiers|compliance/.test(text)) queries.push('conditions generales utilisation conformite tiers');
  if (/frais|tarif|limite|plafond|fees|pricing/.test(text)) queries.push('tarifs tarification paiements frais', 'retraits plafonds dashboard API');
  if (/kyc|verifi|beneficiaire|commercant/.test(text)) queries.push('verification KYC KYB beneficiaires');
  if (/sandbox|test|documentation|code|sdk/.test(text)) queries.push('test sandbox live quickstart');
  return [...queries, query];
}
