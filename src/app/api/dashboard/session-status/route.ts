import { NextResponse } from 'next/server';
import { getCurrentSessionStatus } from '@/app/dashboard/settings/sessions-actions';

export const dynamic = 'force-dynamic';

export async function GET() {
  const status = await getCurrentSessionStatus();
  return NextResponse.json(status, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
