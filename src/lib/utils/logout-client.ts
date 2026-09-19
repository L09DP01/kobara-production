import { signOut } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

export async function performFullLogout() {
  if (typeof window === 'undefined') return;

  const isLocal = window.location.hostname === 'localhost'
    || window.location.hostname.includes('127.0.0.1');
  const logoutTarget = isLocal ? '/logout' : 'https://kobara.app/logout';

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();

    const localSignOut = (async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
    })();
    const nextAuthSignOut = signOut({ callbackUrl: logoutTarget, redirect: false });

    // Client-side providers are best effort. The server endpoint below remains
    // the source of truth and clears every Kobara session cookie.
    await Promise.race([
      Promise.allSettled([localSignOut, nextAuthSignOut]),
      new Promise((resolve) => window.setTimeout(resolve, 2500)),
    ]);
  } catch (e) {
    console.error("Full logout error:", e);
  } finally {
    window.location.replace(logoutTarget);
  }
}
