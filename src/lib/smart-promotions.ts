import { createHmac, timingSafeEqual } from 'node:crypto';

export const PROMOTION_SEGMENTS = {
  links_no_payment: { label: 'Liens sans premier paiement', query: 'partager un lien de paiement Kobara', cta: 'https://dashboard.kobara.app/payment-links' },
  api_not_started: { label: 'API pas encore démarrée', query: 'premier paiement API quickstart Kobara', cta: 'https://docs.kobara.app/docs/quickstart' },
  inactive30: { label: 'Inactifs depuis trente jours', query: 'reprendre les paiements liens checkout Kobara', cta: 'https://dashboard.kobara.app' },
} as const;
export type PromotionSegment = keyof typeof PROMOTION_SEGMENTS;
export function isPromotionSegment(value: string): value is PromotionSegment { return Object.hasOwn(PROMOTION_SEGMENTS, value); }

export function validatePromotionCopy(value: unknown): { subject: string; body: string } {
  if (!value || typeof value !== 'object') throw new Error('Message invalide.');
  const { subject, body } = value as Record<string, unknown>;
  if (typeof subject !== 'string' || typeof body !== 'string' || !subject.trim() || !body.trim() || subject.length > 160 || body.length > 1200
    || /[\d<>%]|https?:|www\.|gratuit|rabais|r[eé]duction|garanti|instantan[eé]|offre limit[eé]e|\b(?:HTG|USD|gourdes?)\b/i.test(`${subject}\n${body}`)) {
    throw new Error('Le texte contient une promesse commerciale ou un format non autorisé. Régénérez-le.');
  }
  return { subject: subject.trim(), body: body.trim() };
}
export function promotionToken(id: string, secret: string): string {
  if (secret.length < 32 || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Configuration de désabonnement indisponible.');
  return `${id}.${createHmac('sha256', secret).update(`promotion-unsubscribe:${id}`).digest('hex')}`;
}
export function validPromotionToken(token: string, secret: string): string | null {
  const [id, signature, extra] = token.split('.');
  if (extra || !id || !/^[a-f0-9]{64}$/i.test(signature || '')) return null;
  try {
    const expected = promotionToken(id, secret).split('.')[1];
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')) ? id : null;
  } catch { return null; }
}
