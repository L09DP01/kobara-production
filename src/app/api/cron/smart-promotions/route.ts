import { NextResponse } from 'next/server';
import { sendSmartPromotions } from '@/lib/server/messaging/smart-promotions';
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ success: true, ...await sendSmartPromotions() }); }
  catch { return NextResponse.json({ error: 'Promotions unavailable' }, { status: 503 }); }
}
