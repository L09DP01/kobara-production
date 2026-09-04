import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getCurrentSessionStatus } from '@/app/dashboard/settings/sessions-actions';
import {
  SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
  isSessionInactive,
} from '@/lib/session-inactivity';

export const dynamic = 'force-dynamic';

async function readSessionStatus({ recordActivity }: { recordActivity: boolean }) {
  const cookieStore = await cookies();
  const lastActivity = cookieStore.get('kobara_last_activity')?.value;

  if (lastActivity && isSessionInactive(lastActivity)) {
    return NextResponse.json(
      { active: false, status: 'inactive' },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  }

  const status = await getCurrentSessionStatus();
  const response = NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });

  if (status.active && (recordActivity || !lastActivity)) {
    const headersList = await headers();
    const hostname = headersList.get('host')?.split(':')[0] || 'kobara.app';
    const isLocal = hostname.includes('localhost') || hostname.includes('local');
    response.cookies.set('kobara_last_activity', Date.now().toString(), {
      domain: isLocal ? 'localhost' : '.kobara.app',
      maxAge: SESSION_ACTIVITY_COOKIE_MAX_AGE_SECONDS,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: !isLocal,
    });
  }

  return response;
}

export async function GET() {
  return readSessionStatus({ recordActivity: false });
}

export async function POST() {
  return readSessionStatus({ recordActivity: true });
}
