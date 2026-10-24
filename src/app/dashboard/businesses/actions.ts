'use server';

import { auth } from '@/auth';
import { cookies } from 'next/headers';
import { MERCHANT_CONTEXT_COOKIE, lastBusinessCookie, isMerchantId, resolveMerchantContext } from '@/lib/server/merchant-context';
import { ensureAccountSessionIsAllowed } from '@/app/dashboard/settings/sessions-actions';
import { createOwnedBusiness } from '@/lib/server/create-business';

async function selectBusiness(merchantId: string, userId: string) {
  const store = await cookies();
  const options = {
    // This is an identifier, not a credential. Both the server and RLS validate membership.
    httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 31_536_000,
  };
  store.set(MERCHANT_CONTEXT_COOKIE, merchantId, options);
  store.set(lastBusinessCookie(userId), merchantId, { ...options, httpOnly: true });
}

export async function switchBusinessAction(merchantId: string) {
  const session = await auth();
  if (!session?.user?.id || !isMerchantId(merchantId)) return { error: 'Business non autorisé.' };
  const { merchant } = await resolveMerchantContext(session.user.id, merchantId);
  if (!merchant) return { error: 'Vous n’avez plus accès à ce business.' };
  const sessionCheck = await ensureAccountSessionIsAllowed();
  if (!sessionCheck.allowed) return { error: 'Votre session doit être renouvelée.' };
  await selectBusiness(merchant.id, session.user.id);
  return { success: true };
}

export async function createBusinessAction(input: unknown) {
  const session = await auth();
  if (!session?.user?.id) return { error: 'Veuillez vous connecter.' };
  const cookieStore = await cookies();
  const { merchant, userRole } = await resolveMerchantContext(session.user.id, cookieStore.get(MERCHANT_CONTEXT_COOKIE)?.value);
  if (!merchant || userRole !== 'owner') return { error: 'Seul le propriétaire peut ajouter un business.' };
  const sessionCheck = await ensureAccountSessionIsAllowed();
  if (!sessionCheck.allowed) return { error: 'Votre session doit être renouvelée.' };
  const result = await createOwnedBusiness(session.user.id, merchant.id, input);
  if (result.error || !result.merchantId) return result;
  await selectBusiness(result.merchantId, session.user.id);
  return result;
}
