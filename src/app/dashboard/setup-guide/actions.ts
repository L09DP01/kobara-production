'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';
import type { IntegrationChoice } from '@/lib/server/onboarding/merchant-setup';

async function requireApprovedOwner() {
  const { merchant, userRole } = await getCurrentUserAndMerchant();
  if (userRole !== 'owner') throw new Error('Seul le propriétaire peut configurer ce compte.');
  if (merchant.kyc_status !== 'approved') throw new Error('La vérification KYC doit être approuvée.');
  return merchant;
}

export async function confirmPaymentMethodsAction() {
  const merchant = await requireApprovedOwner();
  const { error } = await createAdminClient().from('merchant_setup_progress').upsert({
    merchant_id: merchant.id,
    payment_methods_confirmed_at: new Date().toISOString(),
  }, { onConflict: 'merchant_id' });
  if (error) throw new Error('Impossible de valider les moyens de paiement.');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { success: true };
}

export async function selectIntegrationAction(choice: Exclude<IntegrationChoice, null>) {
  const merchant = await requireApprovedOwner();
  if (!['payment_link', 'api'].includes(choice)) throw new Error('Choix d’intégration invalide.');
  const { error } = await createAdminClient().from('merchant_setup_progress').upsert({
    merchant_id: merchant.id,
    integration_choice: choice,
  }, { onConflict: 'merchant_id' });
  if (error) throw new Error('Impossible d’enregistrer ce choix.');
  revalidatePath('/dashboard');
  redirect(choice === 'api' ? '/dashboard/api-keys' : '/dashboard/payment-links/create');
}
