import 'server-only';

import { z } from 'zod';
import { createAdminClient } from '@/utils/supabase/admin';
import { isMerchantId, resolveMerchantContext } from '@/lib/server/merchant-context';
import { BUSINESS_NAME_TAKEN_MESSAGE, getBusinessNameValidationError, isBusinessNameConflict, normalizeBusinessName } from '@/lib/business-name';
import { businessCreationError } from '@/lib/business-creation-error';

export const businessSchema = z.object({
  requestId: z.uuid(), business_name: z.string(), category: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{8,25}$/), address: z.string().trim().min(5).max(500),
  description: z.string().trim().min(20).max(2000),
  website: z.union([z.literal(''), z.url().max(500)]).optional(),
});

// Callers authenticate the web session or the private Telegram link first.
// Ownership is independently checked here and again by the atomic database RPC.
export async function createOwnedBusiness(userId: string, sourceId: string, input: unknown) {
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { error: 'Vérifiez le nom, le téléphone, l’adresse et la description de l’activité.' };
  const businessName = normalizeBusinessName(parsed.data.business_name);
  const nameError = getBusinessNameValidationError(businessName);
  if (nameError) return { error: nameError };
  const { merchant, userRole, accessibleMerchants } = await resolveMerchantContext(userId, sourceId, true);
  if (!merchant || userRole !== 'owner') return { error: 'Seul le propriétaire peut ajouter un business.' };
  const { data, error } = await createAdminClient().rpc('create_additional_business', {
    p_user_id: userId, p_source_merchant_id: merchant.id, p_request_id: parsed.data.requestId,
    p_name: businessName, p_category: parsed.data.category, p_phone: parsed.data.phone,
    p_address: parsed.data.address, p_description: parsed.data.description, p_website: parsed.data.website || null,
  });
  if (error) {
    if (isBusinessNameConflict(error)) return { error: BUSINESS_NAME_TAKEN_MESSAGE };
    if (error.message?.includes('verified_owner_required')) return { error: businessCreationError(merchant, accessibleMerchants) };
    if (error.message?.includes('business_creation_rate_limit')) return { error: 'Trop de créations récentes. Réessayez plus tard.' };
    if (['PGRST202', '42883'].includes(error.code)) return { error: 'La création de business sera disponible après activation par Kobara.' };
    console.error('[Business] Creation failed', { code: error.code });
    return { error: 'Le business n’a pas pu être créé. Réessayez ou contactez le support.' };
  }
  if (!isMerchantId(data)) return { error: 'Réponse de création invalide.' };
  return { success: true, merchantId: data as string };
}
