'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminSessionManager({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isClient, setIsClient] = useState(false);

  // 5 minutes d'inactivité max
  const TIMEOUT_MS = 5 * 60 * 1000;

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch (e) { }
    router.push('/system-core/login?reason=timeout');
    router.refresh();
  };

  const refreshSession = async () => {
    try {
      const res = await fetch('/api/admin/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        handleLogout();
      }
    } catch (e) {
      // ignore network errors, but logout on hard failures
    }
  };

  const resetTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(handleLogout, TIMEOUT_MS);
  };

  useEffect(() => {
    setIsClient(true);
    resetTimeout();
    
    // Initialiser un timer pour rafraîchir le JWT côté serveur chaque minute
    // si l'utilisateur est toujours actif
    const refreshInterval = setInterval(refreshSession, 60 * 1000);

    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    
    // Throttling the reset to avoid triggering too many events
    let lastEventTime = Date.now();
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastEventTime > 2000) { // Only reset every 2 seconds max
        lastEventTime = now;
        resetTimeout();
      }
    };

    events.forEach(evt => window.addEventListener(evt, handleActivity));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleActivity));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearInterval(refreshInterval);
    };
  }, []);

  if (!isClient) return null;

  return <>{children}</>;
}
