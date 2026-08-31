export type MaintenanceState = {
  enabled: boolean;
  announcement_enabled: boolean;
  auto_start: boolean;
  scheduled_for: string | null;
  title: string;
  message: string;
  maintenance_message: string;
  updated_at?: string | null;
  updated_by?: string | null;
};

export const DEFAULT_MAINTENANCE_STATE: MaintenanceState = {
  enabled: false,
  announcement_enabled: false,
  auto_start: false,
  scheduled_for: null,
  title: 'Maintenance programmée',
  message: 'Une maintenance est prévue dimanche à 17 h. Les services Kobara seront temporairement indisponibles.',
  maintenance_message: 'Les services Kobara sont temporairement suspendus pendant une intervention planifiée. Ils seront rétablis dès la fin des vérifications.',
};

export function normalizeMaintenanceState(value: unknown): MaintenanceState {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    enabled: raw.enabled === true,
    announcement_enabled: typeof raw.announcement_enabled === 'boolean'
      ? raw.announcement_enabled
      : DEFAULT_MAINTENANCE_STATE.announcement_enabled,
    auto_start: typeof raw.auto_start === 'boolean'
      ? raw.auto_start
      : DEFAULT_MAINTENANCE_STATE.auto_start,
    scheduled_for: typeof raw.scheduled_for === 'string'
      ? raw.scheduled_for
      : DEFAULT_MAINTENANCE_STATE.scheduled_for,
    title: typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : DEFAULT_MAINTENANCE_STATE.title,
    message: typeof raw.message === 'string' && raw.message.trim()
      ? raw.message.trim().slice(0, 500)
      : DEFAULT_MAINTENANCE_STATE.message,
    maintenance_message: typeof raw.maintenance_message === 'string' && raw.maintenance_message.trim()
      ? raw.maintenance_message.trim().slice(0, 500)
      : DEFAULT_MAINTENANCE_STATE.maintenance_message,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
    updated_by: typeof raw.updated_by === 'string' ? raw.updated_by : null,
  };
}

export function isMaintenanceActive(state: MaintenanceState, now = new Date()) {
  if (state.enabled) return true;
  if (!state.auto_start || !state.scheduled_for) return false;
  const scheduledTime = new Date(state.scheduled_for).getTime();
  return Number.isFinite(scheduledTime) && now.getTime() >= scheduledTime;
}

export function maintenanceRetryAfter(state: MaintenanceState, now = new Date()) {
  if (!state.scheduled_for) return 3600;
  const seconds = Math.ceil((new Date(state.scheduled_for).getTime() - now.getTime()) / 1000);
  return Math.max(60, Number.isFinite(seconds) && seconds > 0 ? seconds : 3600);
}

export function isMaintenanceBypassPath(pathname: string) {
  return pathname === '/maintenance'
    || pathname === '/api/system-status'
    || pathname.startsWith('/system-core')
    || pathname.startsWith('/api/admin')
    || pathname.startsWith('/api/webhooks')
    || pathname.startsWith('/api/cron');
}
