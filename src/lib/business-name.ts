export const BUSINESS_NAME_TAKEN_MESSAGE =
  "Ce nom d'entreprise est déjà utilisé par un autre compte.";

export function normalizeBusinessName(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function getBusinessNameValidationError(value: unknown): string | null {
  const businessName = normalizeBusinessName(value);

  if (!businessName) {
    return "Le nom de l'entreprise est obligatoire.";
  }

  if (businessName.length < 2) {
    return "Le nom de l'entreprise doit comporter au moins 2 caractères.";
  }

  if (businessName.length > 255) {
    return "Le nom de l'entreprise ne peut pas dépasser 255 caractères.";
  }

  // 1. Interdiction des liens, URLs et domaines web
  const hasUrlOrLink =
    /\bhttps?:\/\//i.test(businessName) ||
    /\bwww\./i.test(businessName) ||
    /\.(com|net|org|io|app|ht|co|dev|fr|me|info|biz|tech|store|shop|online|site|xyz|ai|cloud)\b/i.test(businessName) ||
    /(\/\/|\.[\w-]+\/)/i.test(businessName);

  if (hasUrlOrLink) {
    return "Les liens ou adresses web ne sont pas autorisés dans le nom de l'entreprise.";
  }

  // 2. Interdiction des chiffres et numéros (0-9)
  if (/\d/.test(businessName)) {
    return "Les chiffres et numéros ne sont pas autorisés dans le nom de l'entreprise.";
  }

  // 3. Interdiction des caractères spéciaux (seules les lettres avec accents et les espaces simples sont autorisés)
  if (!/^[\p{L}\s]+$/u.test(businessName)) {
    return "Les caractères spéciaux ne sont pas autorisés dans le nom de l'entreprise (seules les lettres et les espaces sont acceptés).";
  }

  return null;
}

export function isBusinessNameConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const databaseError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    constraint?: string;
  };
  const context = [
    databaseError.message,
    databaseError.details,
    databaseError.hint,
    databaseError.constraint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return databaseError.code === '23505' && (
    context.includes('business_name_already_exists') ||
    context.includes('merchants_business_name_normalized_key')
  );
}
