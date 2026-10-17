const secretPatterns = [
  /\bkbr_(?:sk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/i,
  /\bkbr_(?:live|test)_[A-Za-z0-9_-]{16,}\b/i,
  /\b(?:api[_ -]?key|secret[_ -]?key|webhook[_ -]?secret)\s*[:=]\s*[A-Za-z0-9_./+-]{12,}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]{16,}\b/i,
];

export function containsPotentialSecret(value: string) {
  return secretPatterns.some((pattern) => pattern.test(value));
}

export function redactSecrets(value: string) {
  return secretPatterns.reduce((text, pattern) => text.replace(new RegExp(pattern.source, `${pattern.flags}g`), '[SECRET MASQUE]'), value);
}
