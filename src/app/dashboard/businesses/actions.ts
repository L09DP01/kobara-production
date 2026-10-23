'use server';

import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/utils/supabase/admin';
import { MERCHANT_CONTEXT_COOKIE, isMerchantId, resolveMerchantContext } from '@/lib/server/merchant-context';
import { BUSINESS_NAME_TAKEN_MESSAGE, getBusinessNameValidationError, isBusinessNameConflict, normalizeBusinessName } from '@/lib/business-name';
import { ensureAccountSessionIsAllowed } from '@/app/dashboard/settings/sessions-actions';
import { z } from 'zod';

const businessSchema = z.object({
  requestId: z.uuid(), business_name: z.string(), category: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[\d\s()-]{8,25}$/), address: z.string().trim().min(5).max(500),
  description: z.string().trim().min(20).max(2000),
  website: z.union([z.literal(''), z.url().max(500)]).optional(),
});

async function selectBusiness(merchantId: string) {
  (await cookies()).set(MERCHANT_CONTEXT_COOKIE, merchantId, {
    // This is an identifier, not a credential. Both the server and RLS validate membership.
    httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 31_536_000,
  });
}

export async function switchBusinessAction(merchantId: string) {
  const session = await auth();
  if (!session?.user?.id || !isMerchantId(merchantId)) return { error: 'Business non autorisé.' };
  const { merchant } = await resolveMerchantContext(session.user.id, merchantId);
  if (!merchant) return { error: 'Vous n’avez plus accès à ce business.' };
  const sessionCheck = await ensureAccountSessionIsAllowed();
  if (!sessionCheck.allowed) return { error: 'Votre session doit être renouvelée.' };
  await selectBusiness(merchant.id);
  return { success: true };
}

export async function createBusinessAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Veuillez vous connecter.' };
  const parsed = businessSchema.safeParse(input);
  if (!parsed.success) return { error: 'Vérifiez le nom, le téléphone, l’adresse et la description de l’activité.' };
  const businessName = normalizeBusinessName(parsed.data.business_name);
  const nameError = getBusinessNameValidationError(businessName);
  if (nameError) return { error: nameError };
  const cookieStore = await cookies();
  const { merchant, userRole } = await resolveMerchantContext(session.user.id, cookieStore.get(MERCHANT_CONTEXT_COOKIE)?.value);
  if (!merchant || userRole !== 'owner') return { error: 'Seul le propriétaire peut ajouter un business.' };
  const sessionCheck = await ensureAccountSessionIsAllowed();
  if (!sessionCheck.allowed) return { error: 'Votre session doit être renouvelée.' };
  const { data, error } = await createAdminClient().rpc('create_additional_business', {
    p_user_id: session.user.id, p_source_merchant_id: merchant.id, p_request_id: parsed.data.requestId,
    p_name: businessName, p_category: parsed.data.category, p_phone: parsed.data.phone,
    p_address: parsed.data.address, p_description: parsed.data.description, p_website: parsed.data.website || null,
  });
  if (error) {
    if (isBusinessNameConflict(error)) return { error: BUSINESS_NAME_TAKEN_MESSAGE };
    if (error.message?.includes('verified_owner_required')) return { error: 'L’identité du propriétaire doit être validée et sans restriction.' };
    if (error.message?.includes('business_creation_rate_limit')) return { error: 'Trop de créations récentes. Réessayez plus tard.' };
    if (['PGRST202', '42883'].includes(error.code)) return { error: 'La création de business sera disponible après activation par Kobara.' };
    console.error('[Business] Creation failed', { code: error.code });
    return { error: 'Le business n’a pas pu être créé. Réessayez ou contactez le support.' };
  }
  if (!isMerchantId(data)) return { error: 'Réponse de création invalide.' };
  await selectBusiness(data);
  return { success: true, merchantId: data };
}
