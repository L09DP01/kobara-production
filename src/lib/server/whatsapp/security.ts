import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'crypto';

const secretPatterns = [
  /\bkbr_(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/i,
  /\b(?:api[_ -]?key|secret[_ -]?key|webhook[_ -]?secret)\s*[:=]\s*[A-Za-z0-9_./+-]{12,}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}\b/i,
];

export function containsPotentialSecret(value: string) {
  return secretPatterns.some((pattern) => pattern.test(value));
}

export function redactSecrets(value: string) {
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, '[SECRET MASQUE]'), value);
}

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
