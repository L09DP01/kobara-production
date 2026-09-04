'use client';

import { useEffect } from 'react';
import {
  SESSION_ACTIVITY_STORAGE_KEY,
  isSessionInactive,
  markClientSessionActive,
} from '@/lib/session-inactivity';

const SERVER_ACTIVITY_SYNC_INTERVAL_MS = 60_000;
const SESSION_STATUS_INTERVAL_MS = 30_000;

function getLogoutUrl() {
  if (window.location.hostname.includes('localhost')) {
    return '/logout?reason=inactive';
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app').replace(/\/+$/, '');
  return `${appUrl}/logout?reason=inactive`;
}

export function SessionInactivityGuard() {
  useEffect(() => {
    let stopped = false;
    let redirecting = false;
    let lastServerSync = 0;

    const logoutForInactivity = () => {
      if (redirecting) return;
      redirecting = true;
      window.localStorage.removeItem(SESSION_ACTIVITY_STORAGE_KEY);
      window.location.replace(getLogoutUrl());
    };

    const readLastActivity = () => window.localStorage.getItem(SESSION_ACTIVITY_STORAGE_KEY) || undefined;

    const syncActivityWithServer = async (now: number) => {
      if (now - lastServerSync < SERVER_ACTIVITY_SYNC_INTERVAL_MS) return;
      lastServerSync = now;

      try {
        const response = await fetch('/api/dashboard/session-status', {
          method: 'POST',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const status = await response.json();
        if (!stopped && status.active === false) logoutForInactivity();
      } catch {
        // A protected page request will still enforce the server-side timeout.
      }
    };

    const recordActivity = () => {
      const now = Date.now();
      if (isSessionInactive(readLastActivity(), now)) {
        logoutForInactivity();
        return;
      }

      markClientSessionActive(now);
      void syncActivityWithServer(now);
    };

    const checkSession = async () => {
      if (isSessionInactive(readLastActivity())) {
        logoutForInactivity();
        return;
      }

      try {
        const response = await fetch('/api/dashboard/session-status', {
          method: 'GET',
          cache: 'no-store',
          credentials: 'same-origin',
        });
        if (!response.ok) return;
        const status = await response.json();
        if (!stopped && status.active === false) logoutForInactivity();
      } catch {
        // The middleware remains the final server-side guard.
      }
    };

    const storedActivity = readLastActivity();
    if (storedActivity && isSessionInactive(storedActivity)) {
      logoutForInactivity();
      return;
    }

    if (!storedActivity) markClientSessionActive();
    void checkSession();

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, recordActivity, { passive: true });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') recordActivity();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_ACTIVITY_STORAGE_KEY && event.newValue && isSessionInactive(event.newValue)) {
        logoutForInactivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorage);
    const intervalId = window.setInterval(checkSession, SESSION_STATUS_INTERVAL_MS);

    return () => {
      stopped = true;
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, recordActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorage);
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
}
