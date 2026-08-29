import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { PayPalService } from '@/lib/server/payments/paypal';
import { finalizePayPalCapture } from '@/lib/server/payments/paypal-finalizer';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const paymentId = request.nextUrl.searchParams.get('payment_id');
  const reference = request.nextUrl.searchParams.get('reference');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
  const supabase = createAdminClient();

  let query = supabase.from('payments').select('*');
  if (paymentId) query = query.eq('id', paymentId);
  else if (reference) query = query.eq('kobara_reference', reference);
  else if (token) query = query.eq('paypal_order_id', token);
  else return NextResponse.redirect(`${appUrl}/pay/error?error=payment_context_missing`);

  const { data: payment } = await query.maybeSingle();
  if (!payment) return NextResponse.redirect(`${appUrl}/pay/error?error=payment_not_found`);
  const successUrl = payment.success_url || `${appUrl}/pay/success?reference=${encodeURIComponent(payment.kobara_reference)}&amount=${encodeURIComponent(String(payment.amount))}`;
  if (payment.status === 'succeeded') return NextResponse.redirect(successUrl);

  const orderId = token || payment.paypal_order_id;
  if (!orderId) return NextResponse.redirect(`${appUrl}/pay/error?error=paypal_order_missing`);

  const capture = await PayPalService.captureOrder(orderId);
  if (!capture.success) {
    const cancelUrl = payment.cancel_url || payment.error_url || `${appUrl}/pay/checkout/${payment.id}?error=capture_failed`;
    return NextResponse.redirect(cancelUrl);
  }

  try {
    await finalizePayPalCapture({
      paymentId: payment.id,
      orderId,
      requestedMethod: payment.payment_source || 'paypal',
      capture,
    });
    return NextResponse.redirect(successUrl);
  } catch (error) {
    console.error('[PayPal Return] Finalization failed:', error);
    return NextResponse.redirect(`${appUrl}/pay/error?error=finalization_failed`);
  }
}
