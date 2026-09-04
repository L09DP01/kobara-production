'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Clock3, X } from 'lucide-react';
import type { MaintenanceState } from '@/lib/maintenance-state';

type PublicMaintenanceState = MaintenanceState & { active: boolean };

const DISMISSED_ANNOUNCEMENT_KEY = 'kobara:dismissed-announcement';

function isBannerExcludedPath(pathname: string) {
  return pathname === '/login'
    || pathname.startsWith('/login/')
    || pathname === '/register'
    || pathname.startsWith('/register/')
    || pathname === '/system-core/login'
    || pathname === '/pay'
    || pathname.startsWith('/pay/');
}

function getAnnouncementId(state: PublicMaintenanceState) {
  return JSON.stringify([
    state.active,
    state.scheduled_for,
    state.title,
    state.message,
    state.maintenance_message,
  ]);
}

export function MaintenanceBanner() {
  const pathname = usePathname();
  const [state, setState] = useState<PublicMaintenanceState | null>(null);
  const [dismissedAnnouncement, setDismissedAnnouncement] = useState<string | null>(null);
  const excluded = isBannerExcludedPath(pathname);

  useEffect(() => {
    if (excluded) return;

    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/system-status', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (mounted) {
          setDismissedAnnouncement(window.localStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY));
          setState(payload);
        }
      } catch {
        // The announcement must never make a page unusable.
      }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [excluded]);

  if (excluded || !state || (!state.announcement_enabled && !state.active)) return null;

  const announcementId = getAnnouncementId(state);
  if (dismissedAnnouncement === announcementId) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_ANNOUNCEMENT_KEY, announcementId);
    setDismissedAnnouncement(announcementId);
  };

  return (
    <div className={`fixed inset-x-0 bottom-0 z-[200] border-t px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] ${state.active ? 'border-red-400/40 bg-red-950 text-red-50' : 'border-amber-300/30 bg-[#2A1C05] text-amber-50'}`} role="status" aria-live="polite">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 pl-8 text-sm font-semibold">
        <div className="flex items-center justify-center gap-3 text-center">
          {state.active ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" /> : <Clock3 className="h-5 w-5 shrink-0 text-amber-300" />}
          <p><strong>{state.active ? 'Maintenance en cours' : state.title}</strong> <span className="font-normal opacity-90">{state.active ? state.maintenance_message : state.message}</span></p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="grid h-9 w-9 shrink-0 place-items-center border border-current/20 text-current transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          aria-label="Fermer l'annonce"
          title="Fermer l'annonce"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
