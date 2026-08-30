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
    announcement_enabled: enabled,
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
  revalidatePath('/system-core/dashboard');
}
