'use server';

import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from '@/lib/server/mail';

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

export async function setMerchantAccountSuspended(merchantId: string, suspended: boolean) {
  const session = await requireAdmin(['super_admin', 'operations']);
  const admin = createAdminClient();
  const { data: merchant, error: merchantError } = await admin
    .from('merchants')
    .select('id, business_name, email, status')
    .eq('id', merchantId)
    .maybeSingle();

  if (merchantError || !merchant) {
    throw new Error(merchantError?.message || 'Marchand introuvable.');
  }

  const targetStatus = suspended ? 'suspended' : 'active';
  if (merchant.status === targetStatus) return;

  const { error: updateError } = await admin
    .from('merchants')
    .update({ status: targetStatus, updated_at: new Date().toISOString() })
    .eq('id', merchantId);
  if (updateError) throw new Error(updateError.message);

  const title = suspended ? 'Compte Kobara suspendu' : 'Compte Kobara réactivé';
  const message = suspended
    ? `Bonjour ${merchant.business_name || ''},\n\nVotre compte marchand Kobara a été suspendu. Les paiements, liens de paiement, retraits et accès API associés sont temporairement bloqués.\n\nPour obtenir les détails ou demander un examen, contactez support@kobara.app depuis l’adresse e-mail associée à votre compte.`
    : `Bonjour ${merchant.business_name || ''},\n\nVotre compte marchand Kobara a été réactivé. Vous pouvez de nouveau accéder aux services autorisés sur votre compte.`;

  await admin.from('notifications').insert({
    merchant_id: merchantId,
    type: suspended ? 'account_suspended' : 'account_restored',
    title,
    message,
    resource_id: `${merchantId}:${targetStatus}:${Date.now()}`,
  });

  const emailResult = merchant.email
    ? await sendEmail({ to: merchant.email, subject: `Kobara - ${title}`, text: message })
        .catch((error: unknown) => ({ success: false, error: error instanceof Error ? error.message : 'Erreur e-mail' }))
    : { success: false, error: 'Adresse e-mail absente' };

  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    merchant_id: merchantId,
    action: suspended ? 'merchant.suspended' : 'merchant.restored',
    entity_type: 'merchants',
    entity_id: merchantId,
    metadata: {
      previous_status: merchant.status,
      status: targetStatus,
      email_sent: emailResult.success,
      email_error: emailResult.error || null,
      changed_by: session.user.email,
    },
  });

  revalidatePath(`/system-core/merchants/${merchantId}`);
  revalidatePath('/system-core/merchants');
  revalidatePath('/dashboard');
}
