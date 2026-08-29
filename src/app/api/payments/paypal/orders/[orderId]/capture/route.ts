import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { PayPalService } from '@/lib/server/payments/paypal';
import { finalizePayPalCapture } from '@/lib/server/payments/paypal-finalizer';
import { normalizePayPalMethod } from '@/lib/server/payments/paypal-checkout';
import { getClientIp, paymentsLimiter } from '@/lib/server/security/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const rateLimit = await paymentsLimiter.limit(`paypal_capture:${getClientIp(request.headers)}`);
    if (!rateLimit.success) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    const origin = request.headers.get('origin');
    const originHost = origin ? new URL(origin).hostname : '';
    if (!['pay.kobara.app', 'kobara.app', 'localhost', '127.0.0.1'].includes(originHost)) {
      return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    }

    const { orderId } = await params;
    const body = await request.json();
    const paymentId = String(body?.paymentId || '');
    if (!paymentId || !orderId) return NextResponse.json({ error: 'payment_context_required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: payment } = await supabase
      .from('payments')
      .select('id, status, paypal_order_id, success_url, kobara_reference, amount, metadata')
      .eq('id', paymentId)
      .maybeSingle();
    if (!payment || payment.paypal_order_id !== orderId) {
      return NextResponse.json({ error: 'paypal_order_mismatch' }, { status: 409 });
    }

    const capture = await PayPalService.captureOrder(orderId);
    const result = await finalizePayPalCapture({
      paymentId,
      orderId,
      requestedMethod: normalizePayPalMethod(body?.paymentMethod),
      capture,
    });

    const basePath = request.nextUrl.hostname.startsWith('pay.') ? '' : '/pay';
    const successUrl = result.payment.metadata?.is_subscription_upgrade
      ? `${basePath}/plan-success?payment_id=${encodeURIComponent(paymentId)}`
      : result.payment.success_url || `${basePath}/success?reference=${encodeURIComponent(result.payment.kobara_reference)}&amount=${encodeURIComponent(String(result.payment.amount))}`;

    return NextResponse.json({
      success: true,
      status: 'succeeded',
      paymentId,
      captureId: capture.captureId,
      redirectUrl: successUrl,
    });
  } catch (error) {
    console.error('[PayPal Capture]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'La capture du paiement a échoué.',
    }, { status: 400 });
  }
}
