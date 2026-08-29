import { NextRequest, NextResponse } from 'next/server';
import { PayPalService } from '@/lib/server/payments/paypal';
import { getPayPalCheckoutPayment } from '@/lib/server/payments/paypal-checkout';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { getClientIp, paymentsLimiter } from '@/lib/server/security/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await paymentsLimiter.limit(`paypal_config:${getClientIp(request.headers)}`);
    if (!rateLimit.success) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    const paymentId = request.nextUrl.searchParams.get('payment_id');
    if (!paymentId) return NextResponse.json({ error: 'payment_id_required' }, { status: 400 });

    const payment = await getPayPalCheckoutPayment(paymentId);
    const providerConfig = await getPaymentProviderConfig();
    const host = (request.headers.get('host') || 'pay.kobara.app').split(':')[0].toLowerCase();
    const allowedHost = host === 'pay.kobara.app' || host === 'kobara.app' || host === 'localhost' || host === '127.0.0.1';
    if (!allowedHost) return NextResponse.json({ error: 'checkout_host_not_allowed' }, { status: 403 });

    return NextResponse.json({
      clientId: PayPalService.getPublicClientId(),
      sdkUrl: PayPalService.getWebSdkUrl(),
      environment: PayPalService.getApiBaseUrl().includes('.sandbox.') ? 'sandbox' : 'live',
      currency: 'USD',
      amountUsd: Number(payment.amount_usd || PayPalService.convertHtgToUsd(Number(payment.amount), providerConfig.paypal_htg_per_usd)),
    }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[PayPal Config]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible d'initialiser PayPal.",
    }, { status: 400 });
  }
}
