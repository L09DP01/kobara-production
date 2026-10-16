import { NextResponse } from 'next/server';
import { reconcilePendingSubscriptionPayments } from '@/lib/server/payments/reconcile-subscriptions';

// Protect this endpoint from unauthorized access
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const reconciliation = await reconcilePendingSubscriptionPayments();

    return NextResponse.json({
      success: true,
      processed: 0,
      subscriptionsRetired: true,
      paymentsChecked: reconciliation.checked,
      plansActivated: reconciliation.activated,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
