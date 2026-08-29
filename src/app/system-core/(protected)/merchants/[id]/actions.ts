'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";

export async function toggleMerchantPayPal(merchantId: string, enabled: boolean) {
  try {
    const session = await requireAdmin(['super_admin', 'operations']);
    const adminClient = createAdminClient();

    const { data: updatedMerchant, error: merchantUpdateError } = await adminClient
      .from('merchants')
      .update({ paypal_enabled: enabled })
      .eq('id', merchantId)
      .select('id')
      .maybeSingle();

    if (merchantUpdateError || !updatedMerchant) {
      throw new Error(merchantUpdateError?.message || 'Marchand introuvable.');
    }

    const { data: curSettings, error: settingsReadError } = await adminClient
      .from('settings')
      .select('*')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    if (settingsReadError) {
      console.warn('[SystemCore] PayPal legacy settings read warning:', settingsReadError.message);
    } else {
      const updatedJson = {
        ...(curSettings?.settings_json || {}),
        paypal_enabled: enabled,
      };
      const { error: settingsWriteError } = curSettings
        ? await adminClient
            .from('settings')
            .update({ settings_json: updatedJson, updated_at: new Date().toISOString() })
            .eq('merchant_id', merchantId)
        : await adminClient
            .from('settings')
            .insert({ merchant_id: merchantId, settings_json: updatedJson });
      if (settingsWriteError) {
        console.warn('[SystemCore] PayPal legacy settings write warning:', settingsWriteError.message);
      }
    }

    const { error: auditError } = await adminClient.from('audit_logs').insert({
      admin_id: session.user.id,
      merchant_id: merchantId,
      action: enabled ? 'merchant.paypal_enabled' : 'merchant.paypal_disabled',
      metadata: { paypal_enabled: enabled, changed_by: session.user.email },
    });
    if (auditError) {
      console.warn('[SystemCore] PayPal audit log warning:', auditError.message);
    }

    revalidatePath(`/system-core/merchants/${merchantId}`);
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/withdrawals');
    return { success: true, enabled };
  } catch (error: unknown) {
    console.error('[SystemCore] toggleMerchantPayPal error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Impossible de modifier l'accès PayPal",
    };
  }
}
