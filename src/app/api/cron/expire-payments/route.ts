import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Check authorization (Vercel Cron standard)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Recover every Pay'm payment first. A provider-confirmed payment must
    // never be expired merely because its browser return was interrupted.
    const { reconcilePendingPaymPayments } = await import('@/lib/server/payments/reconcile-subscriptions');
    const paymReconciliation = await reconcilePendingPaymPayments();

    // Calculate 24 hours ago
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Get all pending payments older than 24 hours
    const { data: expiredPayments, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('id, merchant_id, kobara_reference, amount, net_amount, currency, environment')
      .eq('environment', 'live')
      .eq('status', 'pending')
      .lt('created_at', yesterday.toISOString());

    if (fetchError) {
      throw fetchError;
    }

    if (!expiredPayments || expiredPayments.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        paymReconciliation,
        message: "No expired payments found",
      });
    }

    // Update payments to failed
    const expiredIds = expiredPayments.map(p => p.id);
    const { data: claimedPayments, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ status: 'failed' })
      .in('id', expiredIds)
      .eq('status', 'pending')
      .select('id');

    if (updateError) {
      throw updateError;
    }

    const claimedIds = new Set((claimedPayments || []).map(payment => payment.id));
    const paymentsToNotify = expiredPayments.filter(payment => claimedIds.has(payment.id));

    // Process notifications and webhooks for each payment claimed by this run.
    const notifications = paymentsToNotify.map(payment => ({
      merchant_id: payment.merchant_id,
      type: 'payment_failed',
      title: '❌ Paiement expiré',
      message: `Un paiement en attente de ${payment.amount} HTG (Réf: ${payment.kobara_reference}) a expiré après 24h sans validation.`,
    }));
    const { dispatchMerchantWebhook } = await import("@/lib/server/webhooks/dispatcher");

    await Promise.allSettled(paymentsToNotify.map(payment => dispatchMerchantWebhook({
      merchantId: payment.merchant_id,
      environment: 'live',
      eventType: 'payment.failed',
      data: {
        id: payment.id,
        reference: payment.kobara_reference,
        amount: payment.amount,
        net_amount: payment.net_amount,
        currency: payment.currency,
        status: 'failed',
        reason: 'expired',
      },
    })));

    if (notifications.length > 0) {
      await supabaseAdmin.from('notifications').insert(notifications);
    }

    return NextResponse.json({ 
      success: true, 
      count: paymentsToNotify.length,
      paymReconciliation,
      message: `Expired ${paymentsToNotify.length} payments`
    });

  } catch (error: any) {
    console.error("Error expiring payments:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
