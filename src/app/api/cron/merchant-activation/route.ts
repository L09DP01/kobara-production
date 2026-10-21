import { NextResponse } from 'next/server';
import { processActivationReminders } from '@/lib/server/messaging/activation-reminders';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const cleanup = await createAdminClient().rpc('purge_expired_shopify_handoffs');
    if (cleanup.error) console.error('[Shopify] OAuth handoff cleanup unavailable.');
    return NextResponse.json({ success: true, shopify_handoff_cleanup: !cleanup.error, ...await processActivationReminders() });
  }
  catch { return NextResponse.json({ error: 'Activation reminders unavailable' }, { status: 503 }); }
}
