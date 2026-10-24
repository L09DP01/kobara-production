type Business = { id: string; identity_owner_merchant_id?: string | null; kyc_status?: string; status?: string; account_access?: string | null; shopify_review_mode?: boolean };
export const hasBusinessAccess = (access?: string | null) => ['active', 'live', 'limited_live'].includes(access ?? 'active');

export function businessCreationError(source: Business, businesses: Business[]) {
  const owner = source.identity_owner_merchant_id ? businesses.find(b => b.id === source.identity_owner_merchant_id) : source;
  if (!owner) return 'Le profil du propriétaire est introuvable. Contactez le support Kobara.';
  if (owner.shopify_review_mode) return 'Le compte de démonstration Shopify ne peut pas créer de business réel.';
  if ([source, owner].some(b => b.status !== 'active' || !hasBusinessAccess(b.account_access))) {
    return 'Le compte est soumis à une restriction. Contactez le support avant de créer un business.';
  }
  if (owner.kyc_status === 'in_review') return 'La vérification du propriétaire est en cours. Attendez sa validation avant de créer un business.';
  if (owner.kyc_status !== 'approved') return 'Vérifiez votre identité dans Vérification d’identité avant de créer un business.';
  return 'Le serveur n’a pas confirmé l’éligibilité du propriétaire. Contactez le support Kobara pour vérifier le statut du compte.';
}
