import { NextResponse } from 'next/server';
import { processActivationReminders } from '@/lib/server/messaging/activation-reminders';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try { return NextResponse.json({ success: true, ...await processActivationReminders() }); }
  catch { return NextResponse.json({ error: 'Activation reminders unavailable' }, { status: 503 }); }
}
