import { signOut } from 'next-auth/react';
import { createClient } from '@/utils/supabase/client';

export async function performFullLogout() {
  try {
    // 1. Clear local storage and session storage
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }

    // 2. Sign out from Supabase client if active
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("Supabase client signout notice:", e);
    }

    // 3. Determine logout endpoint based on environment
    const isLocal = typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1'));

    const logoutTarget = isLocal ? '/logout' : 'https://kobara.app/logout';

    // 4. Trigger NextAuth signout with callback to /logout
    await signOut({ callbackUrl: logoutTarget, redirect: false });

    // 5. Force hard redirect to /logout to clear all root and subdomain cookies
    window.location.href = logoutTarget;
  } catch (e) {
    console.error("Full logout error:", e);
    window.location.href = '/logout';
  }
}
