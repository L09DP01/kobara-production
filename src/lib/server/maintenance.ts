import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import {
  DEFAULT_MAINTENANCE_STATE,
  normalizeMaintenanceState,
  type MaintenanceState,
} from '@/lib/maintenance-state';

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('system_settings')
    .select('value, updated_at, updated_by')
    .eq('key', 'platform_maintenance')
    .maybeSingle();

  if (error) {
    console.error('Maintenance settings read failed:', error.message);
    return DEFAULT_MAINTENANCE_STATE;
  }

  return normalizeMaintenanceState({
    ...(data?.value || {}),
    updated_at: data?.updated_at,
    updated_by: data?.updated_by,
  });
}
