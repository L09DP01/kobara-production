import 'server-only';

import crypto from 'crypto';

export function createPartnerToken() {
  const raw = crypto.randomBytes(32).toString('base64url');
  return { raw, hash: hashPartnerToken(raw) };
}

export function hashPartnerToken(raw: string) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function maskDestination(value: string) {
  const trimmed = value.trim();
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`;
}

export function encryptPartnerDestination(value: string) {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('La configuration de chiffrement est indisponible.');
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value.trim(), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}
