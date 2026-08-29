export function normalizeSixDigitCode(value: unknown): string | null {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 6 ? digits : null;
}
