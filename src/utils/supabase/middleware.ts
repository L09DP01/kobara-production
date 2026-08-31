import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Forward the pathname so server layouts can detect the current route
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  const supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Extract NextAuth session token from cookies (works in development & production)
  const sessionToken = request.cookies.get("next-auth.session-token")?.value ||
                       request.cookies.get("__Secure-next-auth.session-token")?.value;

  const userLoggedIn = !!sessionToken;

  const pathname = request.nextUrl.pathname;
  const hostname = request.headers.get("host")?.split(":")[0] || request.nextUrl.hostname;

  if (pathname.startsWith('/kyc/mobile')) {
    return supabaseResponse;
  }
  
  // Custom subdomains are public
  if (hostname === 'pay.kobara.app' || hostname === 'api.kobara.app' || hostname === 'docs.kobara.app') {
    return supabaseResponse;
  }

  const isMainDomain = hostname === 'kobara.app' || hostname === 'www.kobara.app' || hostname === 'localhost' || hostname === 'kobara.local';
  const isDashboardSubdomain = hostname === 'dashboard.kobara.app' || hostname === 'dashboard.localhost' || hostname === 'dashboard.kobara.local';

  if (isMainDomain) {
    if (pathname.startsWith('/dashboard')) {
      const pathWithoutDashboard = pathname.replace('/dashboard', '') || '/';
      const redirectUrl = hostname.includes('localhost') || hostname.includes('local') ? 
        `http://dashboard.${hostname.split(':')[0]}:3000${pathWithoutDashboard}${request.nextUrl.search}` :
        `https://dashboard.kobara.app${pathWithoutDashboard}${request.nextUrl.search}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (isDashboardSubdomain) {
    if (pathname === '/') {
      const redirectUrl = hostname.includes('localhost') || hostname.includes('local') ?
        `http://${hostname}:3000/dashboard` :
        `https://dashboard.kobara.app/dashboard`;
      return NextResponse.redirect(redirectUrl);
    }

    // Require authentication for dashboard subdomain (except APIs which have their own auth)
    if (!userLoggedIn && !pathname.startsWith('/api') && !pathname.startsWith('/_next')) {
      const redirectUrl = hostname.includes('localhost') || hostname.includes('local') ?
        `http://${hostname.replace('dashboard.', '')}:3000/login${request.nextUrl.search}` :
        `https://kobara.app/login${request.nextUrl.search}`;
      return NextResponse.redirect(redirectUrl);
    }
  }

  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/confirmed'].includes(pathname);
  const hasAuthMessage = request.nextUrl.searchParams.has('success') || request.nextUrl.searchParams.has('error') || request.nextUrl.searchParams.has('registered') || request.nextUrl.searchParams.has('reset');
  
  // Si l'utilisateur connecté va sur /register → supprimer les cookies de session et laisser passer
  if (pathname === '/register' && userLoggedIn) {
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    // Supprimer tous les cookies NextAuth pour éviter la redirection vers le dashboard
    const cookiesToClear = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.csrf-token',
    ];
    const cookieDomain = hostname.includes('localhost') || hostname.includes('local') ? 'localhost' : '.kobara.app';
    for (const name of cookiesToClear) {
      response.cookies.set(name, '', { 
        domain: cookieDomain, 
        maxAge: 0, 
        path: '/',
        httpOnly: true,
      });
    }
    return response;
  }

  // If user has a session token but is on an auth page with an error/session message, clear cookies to prevent loop
  if (userLoggedIn && isAuthPage && hasAuthMessage) {
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    const cookieDomain = hostname.includes('localhost') || hostname.includes('local') ? 'localhost' : '.kobara.app';
    const cookiesToClear = [
      'next-auth.session-token',
      'next-auth.csrf-token',
      'next-auth.callback-url',
      '__Secure-next-auth.session-token',
      '__Secure-next-auth.callback-url',
      '__Secure-next-auth.csrf-token',
      'kobara_last_activity',
      'kbr_2fa_email_ok',
      'kbr_2fa_totp_ok',
    ];
    for (const name of cookiesToClear) {
      response.cookies.set(name, '', { domain: cookieDomain, maxAge: 0, path: '/' });
    }
    return response;
  }

  // Vérifier l'inactivité de la session (2 heures)
  if (userLoggedIn) {
    const lastActivity = request.cookies.get('kobara_last_activity')?.value;
    const now = Date.now();
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    // If lastActivity is missing but session token exists, treat as expired (inconsistent state)
    const isExpiredByInactivity = lastActivity 
      ? (now - parseInt(lastActivity, 10)) > TWO_HOURS_MS
      : false; // If no lastActivity cookie at all, set it fresh below

    if (lastActivity && isExpiredByInactivity) {
        // Session expirée par inactivité → supprimer tous les cookies
        const response = NextResponse.redirect(
          hostname.includes('localhost') || hostname.includes('local')
            ? `http://${hostname.replace('dashboard.', '').split(':')[0]}:3000/login?error=session_expired`
            : `https://kobara.app/login?error=session_expired`
        );
        const cookieDomain = hostname.includes('localhost') || hostname.includes('local') ? 'localhost' : '.kobara.app';
        const cookiesToClear = [
          'next-auth.session-token',
          'next-auth.csrf-token',
          'next-auth.callback-url',
          '__Secure-next-auth.session-token',
          '__Secure-next-auth.callback-url',
          '__Secure-next-auth.csrf-token',
          'kobara_last_activity',
          'kbr_2fa_email_ok',
          'kbr_2fa_totp_ok',
        ];
        for (const name of cookiesToClear) {
          response.cookies.set(name, '', { domain: cookieDomain, maxAge: 0, path: '/' });
        }
        return response;
    }

    // Mettre à jour le timestamp d'activité
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    const cookieDomain = hostname.includes('localhost') || hostname.includes('local') ? 'localhost' : '.kobara.app';
    response.cookies.set('kobara_last_activity', now.toString(), {
      domain: cookieDomain,
      maxAge: TWO_HOURS_MS / 1000,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !hostname.includes('localhost'),
    });

    // Rediriger les autres pages auth (login, forgot-password, etc.) vers le dashboard
    if (isAuthPage && !hasAuthMessage && pathname !== '/register') {
      const redirectUrl = hostname.includes('localhost') || hostname.includes('local') ?
        `http://dashboard.${hostname.replace('dashboard.', '').split(':')[0]}:3000/dashboard` :
        `https://dashboard.kobara.app/dashboard`;
      const redirectResponse = NextResponse.redirect(redirectUrl);
      redirectResponse.cookies.set('kobara_last_activity', now.toString(), {
        domain: cookieDomain,
        maxAge: TWO_HOURS_MS / 1000,
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: !hostname.includes('localhost'),
      });
      return redirectResponse;
    }

    return response;
  }


  // -------------------------------------------------------------
  // SUPER ADMIN SECURITY
  // -------------------------------------------------------------
  if (pathname.startsWith('/system-core') && !pathname.startsWith('/system-core/login')) {
    const adminToken = request.cookies.get('kbr_admin_token')?.value;
    
    if (!adminToken) {
      const url = request.nextUrl.clone();
      url.pathname = '/system-core/login';
      return NextResponse.redirect(url);
    }

    try {
      // Decode JWT without library inside Edge if necessary, but we have jose.
      // We will do a simple expiration check here or rely on jose if imported.
      // Since jose is imported at the top? We need to import jwtVerify. Let's do it dynamically or import it at top.
      const { jwtVerify } = await import('jose');
      const secretValue = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
      if (!secretValue || secretValue.length < 32) throw new Error('Missing admin JWT secret');
      const secret = new TextEncoder().encode(secretValue);
      const { payload } = await jwtVerify(adminToken, secret);
      
      if (!['super_admin', 'operations', 'compliance', 'support'].includes(String(payload.role))) throw new Error('Invalid role');
    } catch {
      const url = request.nextUrl.clone();
      url.pathname = '/system-core/login';
      const response = NextResponse.redirect(url);
      response.cookies.delete('kbr_admin_token');
      return response;
    }
  }

  if (pathname === '/system-core/login') {
    const adminToken = request.cookies.get('kbr_admin_token')?.value;
    if (adminToken) {
      try {
        const { jwtVerify } = await import('jose');
        const secretValue = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
        if (!secretValue || secretValue.length < 32) throw new Error('Missing admin JWT secret');
        const secret = new TextEncoder().encode(secretValue);
        await jwtVerify(adminToken, secret);
        const url = request.nextUrl.clone();
        url.pathname = '/system-core/dashboard';
        return NextResponse.redirect(url);
      } catch {
        // invalid token, just let them see login page
      }
    }
  }

  return supabaseResponse;
}
