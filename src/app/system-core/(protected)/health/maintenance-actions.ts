'use server';

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { DEFAULT_MAINTENANCE_STATE, isMaintenanceActive, normalizeMaintenanceState } from '@/lib/maintenance-state';
import { notifyVerifiedMerchantsOfMaintenance } from '@/lib/server/maintenance-notifications';

export async function setPlatformMaintenance(enabled: boolean) {
  const session = await requireAdmin(['super_admin']);
  const admin = createAdminClient();
  const { data: currentRow } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'platform_maintenance')
    .maybeSingle();
  const current = normalizeMaintenanceState(currentRow?.value || DEFAULT_MAINTENANCE_STATE);
  const wasActive = isMaintenanceActive(current);
  if (wasActive === enabled && current.enabled === enabled && current.auto_start === false) return;

  const transitionId = randomUUID();
  const nextState = {
    ...current,
    enabled,
    auto_start: false,
    updated_at: new Date().toISOString(),
    updated_by: session.user.email,
  };

  const { error } = await admin.from('system_settings').upsert({
    key: 'platform_maintenance',
    value: nextState,
    updated_at: new Date().toISOString(),
    updated_by: session.user.id,
  }, { onConflict: 'key' });
  if (error) throw new Error(error.message);

  const emailResult = await notifyVerifiedMerchantsOfMaintenance(enabled, transitionId)
    .catch((notificationError: unknown) => ({
      recipients: 0,
      sent: 0,
      failed: 0,
      errors: [notificationError instanceof Error ? notificationError.message : 'Erreur de notification'],
    }));

  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    action: enabled ? 'system.maintenance_enabled' : 'system.maintenance_disabled',
    entity_type: 'system_settings',
    metadata: {
      previous_enabled: current.enabled,
      previous_auto_start: current.auto_start,
      enabled,
      transition_id: transitionId,
      email_recipients: emailResult.recipients,
      email_sent: emailResult.sent,
      email_failed: emailResult.failed,
      email_errors: emailResult.errors.slice(0, 10),
    },
  });

  revalidatePath('/system-core/health');
  revalidatePath('/system-core/alerts');
  revalidatePath('/system-core/dashboard');
}

export async function savePlatformAlertSettings(formData: FormData) {
  const session = await requireAdmin(['super_admin']);
  const admin = createAdminClient();
  const { data: currentRow } = await admin
    .from('system_settings')
    .select('value')
    .eq('key', 'platform_maintenance')
    .maybeSingle();
  const current = normalizeMaintenanceState(currentRow?.value || DEFAULT_MAINTENANCE_STATE);

  const scheduledInput = String(formData.get('scheduled_for') || '').trim();
  const scheduledDate = scheduledInput ? new Date(scheduledInput) : null;
  if (scheduledDate && !Number.isFinite(scheduledDate.getTime())) {
    throw new Error('La date programmée est invalide.');
  }

  const nextState = normalizeMaintenanceState({
    ...current,
    announcement_enabled: formData.get('announcement_enabled') === 'on',
    auto_start: formData.get('auto_start') === 'on',
    scheduled_for: scheduledDate?.toISOString() || null,
    title: formData.get('title'),
    message: formData.get('message'),
    maintenance_message: formData.get('maintenance_message'),
    updated_at: new Date().toISOString(),
    updated_by: session.user.email,
  });

  if (nextState.auto_start && !nextState.scheduled_for) {
    throw new Error('Ajoutez une date avant d’activer le démarrage automatique.');
  }

  const { error } = await admin.from('system_settings').upsert({
    key: 'platform_maintenance',
    value: nextState,
    updated_at: new Date().toISOString(),
    updated_by: session.user.id,
  }, { onConflict: 'key' });
  if (error) throw new Error(error.message);

  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    action: 'system.alert_configuration_updated',
    entity_type: 'system_settings',
    metadata: {
      announcement_enabled: nextState.announcement_enabled,
      auto_start: nextState.auto_start,
      scheduled_for: nextState.scheduled_for,
      title: nextState.title,
    },
  });

  revalidatePath('/system-core/alerts');
  revalidatePath('/system-core/health');
}
