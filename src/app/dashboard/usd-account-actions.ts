'use server';

import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { createAdminClient } from '@/utils/supabase/admin';
import { PayPalService } from '@/lib/server/payments/paypal';
import { revalidatePath } from 'next/cache';

export async function createUsdAccountAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { merchant, user, supabase } = await getCurrentUserAndMerchant();

    const isEligible = await PayPalService.isMerchantEligible(merchant);
    if (!isEligible) {
      return { success: false, error: "L'option de compte USD n'est pas encore disponible pour votre compte. Veuillez contacter le support." };
    }

    const adminClient = createAdminClient();

    // 1. Mettre à jour la table merchants
    await adminClient
      .from('merchants')
      .update({
        has_usd_account: true,
      } as any)
      .eq('id', merchant.id);

    // 2. Mettre à jour settings_json pour redondance
    const { data: curSettings } = await adminClient
      .from('settings')
      .select('*')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    const updatedSettings = {
      ...(curSettings?.settings_json || {}),
      has_usd_account: true,
      usd_account_created_at: new Date().toISOString(),
    };

    if (curSettings) {
      await adminClient
        .from('settings')
        .update({ settings_json: updatedSettings, updated_at: new Date().toISOString() })
        .eq('merchant_id', merchant.id);
    } else {
      await adminClient
        .from('settings')
        .insert({ merchant_id: merchant.id, settings_json: updatedSettings });
    }

    // 3. Audit log
    await adminClient.from('audit_logs').insert({
      merchant_id: merchant.id,
      action: 'merchant.usd_account_created',
      metadata: { created_by_user: user.id, timestamp: new Date().toISOString() },
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (err: any) {
    console.error("Erreur création compte USD:", err);
    return { success: false, error: err.message || "Impossible de créer le compte USD" };
  }
}
