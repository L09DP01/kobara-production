import { NextResponse } from 'next/server';
import { syncSubscriptionLifecycle } from '@/lib/server/plans';
import { reconcilePendingSubscriptionPayments } from '@/lib/server/payments/reconcile-subscriptions';

// Protect this endpoint from unauthorized access
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reconciliation = await reconcilePendingSubscriptionPayments();
    const result = await syncSubscriptionLifecycle();

    return NextResponse.json({
      success: true,
      processed: result?.processed || 0,
      reconciliation: result?.reconciliation || null,
      expirationEmails: result?.expirationEmails || null,
      paymentsChecked: reconciliation.checked,
      plansActivated: reconciliation.activated,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
