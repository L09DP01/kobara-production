import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getRecordedPaymentProcessor } from "@/lib/payment-routing";
import { confirmPaymPayment } from '@/lib/server/payments/confirm-paym-payment';
import { CRYPTO_PAYMENT_WINDOW_MS } from '@/lib/nowpayments';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const paymentId = resolvedParams.id;
    
    if (!paymentId) {
      return NextResponse.json({ error: "Missing payment id" }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, amount, net_amount, currency, status, created_at, expires_at, provider, payment_method, payment_source, kobara_reference, environment, success_url, error_url, metadata, nowpayments_payment_id')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    let currentStatus = payment.status;
    const createdAt = new Date(payment.created_at).getTime();
    const storedExpiration = payment.expires_at ? new Date(payment.expires_at).getTime() : Number.NaN;
    const deadlineTimestamp = payment.provider === 'crypto'
      ? (Number.isFinite(storedExpiration) ? storedExpiration : createdAt + CRYPTO_PAYMENT_WINDOW_MS)
      : createdAt + 10 * 60 * 1000;
    
    const isPaymProvider = getRecordedPaymentProcessor(payment) === 'paym';

    if ((currentStatus === 'pending' || currentStatus === 'expired')
        && payment.provider === 'crypto'
        && payment.nowpayments_payment_id) {
      try {
        const { getNowPaymentsPayment, applyNowPaymentsStatus } = await import('@/lib/server/payments/nowpayments');
        const providerPayment = await getNowPaymentsPayment(payment.nowpayments_payment_id);
        const applied = await applyNowPaymentsStatus(providerPayment);
        currentStatus = applied.payment?.status || currentStatus;
      } catch (cryptoError) {
        console.warn('[NOWPayments] Status refresh failed:', cryptoError);
      }
    }

    // Pay'm is checked before local expiration because the customer may have
    // completed a genuine provider payment just before returning to Kobara.
    if ((currentStatus === 'pending' || currentStatus === 'expired') && isPaymProvider) {
      const confirmation = await confirmPaymPayment({ paymentId });
      currentStatus = confirmation.status === 'succeeded'
        ? 'succeeded'
        : confirmation.status === 'failed'
          ? 'failed'
          : currentStatus;

      if (confirmation.status === 'pending' && currentStatus === 'pending') {
        const tenMinuteDeadline = new Date(payment.created_at).getTime() + 10 * 60 * 1000;
        if (Date.now() >= tenMinuteDeadline) {
          currentStatus = 'expired';
          await supabase.from('payments').update({ status: 'expired' }).eq('id', paymentId).eq('status', 'pending');
        }
      }
    }

    // For other processors, apply the local checkout expiration normally.
    if (currentStatus === 'pending' && !isPaymProvider && payment.expires_at) {
      const expiresAt = new Date(payment.expires_at);
      if (new Date() > expiresAt) {
        currentStatus = 'expired';
        await supabase.from('payments').update({ status: 'expired' }).eq('id', paymentId);
        return NextResponse.json({ status: 'expired' });
      }
    }

    let responsePayment = payment;
    if (currentStatus === 'succeeded') {
      const { data: refreshedPayment } = await supabase
        .from('payments')
        .select('id, amount, net_amount, currency, status, created_at, expires_at, provider, payment_method, payment_source, kobara_reference, environment, success_url, error_url, metadata, nowpayments_payment_id')
        .eq('id', paymentId)
        .maybeSingle();
      if (refreshedPayment) responsePayment = refreshedPayment;
    }

    let subscription = null;
    if (payment.metadata?.is_subscription_upgrade) {
      const planSlug = String(payment.metadata.plan_slug || '');
      const [{ data: plan }, { data: activatedSubscription }] = await Promise.all([
        planSlug
          ? supabase.from('plans').select('name, slug').eq('slug', planSlug).maybeSingle()
          : Promise.resolve({ data: null }),
        currentStatus === 'succeeded'
          ? supabase
              .from('subscriptions')
              .select('current_period_end, billing_cycle')
              .eq('payment_id', paymentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      subscription = {
        planName: plan?.name || planSlug || 'Plan Kobara',
        planSlug,
        amount: Number(payment.amount),
        currency: 'HTG',
        reference: payment.kobara_reference,
        billingCycle: activatedSubscription?.billing_cycle || payment.metadata.billing_cycle || 'monthly',
        nextBilling: activatedSubscription?.current_period_end || null,
      };
    }

    const reference = responsePayment.kobara_reference || '';
    const successRedirect = payment.metadata?.is_subscription_upgrade
      ? `/pay/plan-success?payment_id=${encodeURIComponent(paymentId)}`
      : responsePayment.success_url || `/pay/success?reference=${encodeURIComponent(reference)}&amount=${encodeURIComponent(String(responsePayment.amount))}&currency=${encodeURIComponent(responsePayment.currency || 'HTG')}&method=${encodeURIComponent(responsePayment.payment_method || responsePayment.provider || '')}`;
    const failureRedirect = payment.error_url
      || `/pay/error?reference=${encodeURIComponent(reference)}&reason=${currentStatus === 'expired' ? 'expired' : 'failed'}`;

    return NextResponse.json({
      status: currentStatus,
      payment: currentStatus === 'succeeded' ? {
        amount: Number(responsePayment.amount),
        netAmount: Number(responsePayment.net_amount || responsePayment.amount),
        currency: responsePayment.currency || 'HTG',
        method: responsePayment.payment_method || responsePayment.provider || null,
      } : null,
      subscription,
      redirectUrl: currentStatus === 'succeeded'
        ? successRedirect
        : ['failed', 'expired', 'canceled'].includes(currentStatus)
          ? failureRedirect
          : null,
      deadline: new Date(deadlineTimestamp).toISOString(),
    });
  } catch (error) {
    console.error("Error fetching payment status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
