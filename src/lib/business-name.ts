export const BUSINESS_NAME_TAKEN_MESSAGE =
  "Ce nom d'entreprise est déjà utilisé par un autre compte.";

const PLACEHOLDER_BUSINESS_WORDS = new Set([
  'asdf', 'demo', 'dummy', 'essai', 'example', 'exemple', 'fake', 'inconnu',
  'none', 'null', 'qwerty', 'sample', 'temp', 'temporary', 'test', 'testing',
  'unknown',
]);

const GENERIC_BUSINESS_WORDS = new Set([
  'business', 'boutique', 'commerce', 'company', 'entreprise', 'marchand',
  'merchant', 'service', 'services', 'shop', 'societe', 'store',
]);

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

  const words = businessName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (words.some((word) => PLACEHOLDER_BUSINESS_WORDS.has(word))) {
    return "Veuillez utiliser le nom réel de votre entreprise; les noms de test ou temporaires ne sont pas acceptés.";
  }

  if (words.every((word) => GENERIC_BUSINESS_WORDS.has(word))) {
    return "Ajoutez un nom distinctif à votre activité, par exemple « Boutique Élégance » plutôt que « Boutique » uniquement.";
  }

  const compactName = words.join('');
  if (/^(.)\1{2,}$/u.test(compactName) || /^(asdf|qwerty)+$/i.test(compactName)) {
    return "Veuillez saisir un nom d'entreprise valide et reconnaissable.";
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
