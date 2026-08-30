import { NextResponse } from 'next/server';
import { notifyKycReminder } from '@/lib/server/notifications';
import { supabaseAdmin } from '@/lib/supabase/admin';

const PAGE_SIZE = 500;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reminderDate = new Date().toISOString().slice(0, 10);
  let offset = 0;
  let scanned = 0;
  let sent = 0;
  let deduplicated = 0;
  let failed = 0;

  while (true) {
    const { data: merchants, error } = await supabaseAdmin
      .from('merchants')
      .select('id, email, kyc_status, status, account_access')
      .or('kyc_status.is.null,kyc_status.in.(pending,not_started,rejected,pending_reverification)')
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('[KYC reminders] Merchant query failed:', error);
      return NextResponse.json({ error: 'Unable to load merchants' }, { status: 500 });
    }

    if (!merchants?.length) break;
    scanned += merchants.length;

    const eligible = merchants.filter((merchant) =>
      Boolean(merchant.email)
      && merchant.status !== 'suspended'
      && !['suspended', 'permanently_closed', 'closure_pending', 'closure_pending_payout'].includes(merchant.account_access || '')
    );

    for (const merchant of eligible) {
      const result = await notifyKycReminder(merchant.id, merchant.email, reminderDate);
      if (result?.deduplicated) deduplicated += 1;
      else if (result?.created && result?.emailSent) sent += 1;
      else failed += 1;
    }

    if (merchants.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return NextResponse.json({
    success: true,
    date: reminderDate,
    scanned,
    sent,
    deduplicated,
    failed,
  });
}
