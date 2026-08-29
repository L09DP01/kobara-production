import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  const hostname = request.headers.get("host")?.split(":")[0] || "kobara.app";
  const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');

  // List of all auth & session cookies used by Kobara
  const cookiesToDelete = [
    'next-auth.session-token',
    'next-auth.csrf-token',
    'next-auth.callback-url',
    '__Secure-next-auth.session-token',
    '__Secure-next-auth.callback-url',
    '__Secure-next-auth.csrf-token',
    'kbr_2fa_email_ok',
    'kbr_2fa_totp_ok',
    'kobara_active_merchant',
    'kobara_last_activity',
    'kbr_passkey_challenge',
  ];

  // Include any Supabase auth cookies (sb-*-auth-token)
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    if (c.name.startsWith('sb-') || c.name.includes('supabase') || c.name.includes('auth')) {
      cookiesToDelete.push(c.name);
    }
  }

  const loginUrl = isLocal 
    ? `http://${hostname.replace('dashboard.', '').split(':')[0]}:3000/login`
    : `${process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app'}/login`;

  const response = NextResponse.redirect(loginUrl);

  const domainsToClear = isLocal 
    ? ['localhost', hostname]
    : ['.kobara.app', 'kobara.app', 'dashboard.kobara.app', hostname];

  for (const name of cookiesToDelete) {
    // Clear via server cookieStore
    cookieStore.delete(name);

    // Clear via response cookies for each domain variation
    for (const d of domainsToClear) {
      response.cookies.set(name, '', {
        domain: d,
        maxAge: 0,
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: !isLocal,
        sameSite: 'lax'
      });
    }

    // Also set without domain attribute
    response.cookies.set(name, '', {
      maxAge: 0,
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: !isLocal,
      sameSite: 'lax'
    });
  }
  
  return response;
}
