'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock3 } from 'lucide-react';
import type { MaintenanceState } from '@/lib/maintenance-state';

type PublicMaintenanceState = MaintenanceState & { active: boolean };

export function MaintenanceBanner() {
  const [state, setState] = useState<PublicMaintenanceState | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/system-status', { cache: 'no-store' });
        if (!response.ok) return;
        const payload = await response.json();
        if (mounted) setState(payload);
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
  }, []);

  if (!state || (!state.announcement_enabled && !state.active)) return null;

  return (
    <div className={`fixed inset-x-0 bottom-0 z-[200] border-t px-4 py-3 shadow-[0_-12px_40px_rgba(0,0,0,0.35)] ${state.active ? 'border-red-400/40 bg-red-950 text-red-50' : 'border-amber-300/30 bg-[#2A1C05] text-amber-50'}`} role="status" aria-live="polite">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 text-center text-sm font-semibold">
        {state.active ? <AlertTriangle className="h-5 w-5 shrink-0 text-red-300" /> : <Clock3 className="h-5 w-5 shrink-0 text-amber-300" />}
        <p><strong>{state.active ? 'Maintenance en cours' : state.title}</strong> <span className="font-normal opacity-90">{state.active ? state.maintenance_message : state.message}</span></p>
      </div>
    </div>
  );
}
