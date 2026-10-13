import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'crypto';

export { containsPotentialSecret, redactSecrets } from '@/lib/sensitive-text';

export function hashVerificationCode(code: string) {
  const pepper = process.env.WHATSAPP_VERIFICATION_PEPPER || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
}

export function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signatureHeader?.startsWith('sha256=')) return false;
  const received = signatureHeader.slice(7);
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(received) || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
}

export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 20);
}

export function isSupportRelated(value: string) {
  const normalized = value.toLowerCase();
  return /(kobara|paiement|payment|peman|retrait|withdraw|retrè|kont|compte|account|api|webhook|checkout|moncash|natcash|kyc|kyb|facture|invoice|solde|balance|tarif|frais|fee|erreur|error|bug|login|connexion|sekirite|sécurité|integration|intégration|ticket|support|transaction)/i.test(normalized);
}

export function extractEmail(value: string) {
  return value.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0]?.toLowerCase() || null;
}
