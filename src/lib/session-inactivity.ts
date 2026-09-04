export const SESSION_INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000;
export const SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ACTIVITY_STORAGE_KEY = 'kobara_last_activity';

export function isSessionInactive(lastActivity: string | number | undefined, now = Date.now()) {
  if (lastActivity === undefined || lastActivity === '') return false;

  const timestamp = typeof lastActivity === 'number'
    ? lastActivity
    : Number.parseInt(lastActivity, 10);

  return !Number.isFinite(timestamp) || now - timestamp >= SESSION_INACTIVITY_TIMEOUT_MS;
}

export function markClientSessionActive(now = Date.now()) {
  window.localStorage.setItem(SESSION_ACTIVITY_STORAGE_KEY, now.toString());
}
