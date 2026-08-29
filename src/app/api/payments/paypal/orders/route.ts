import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrderForPayment, normalizePayPalMethod } from '@/lib/server/payments/paypal-checkout';
import { getClientIp, paymentsLimiter } from '@/lib/server/security/rate-limit';

function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host === 'pay.kobara.app' || host === 'kobara.app' || host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await paymentsLimiter.limit(`paypal_order:${getClientIp(request.headers)}`);
    if (!rateLimit.success) return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
    if (!hasTrustedOrigin(request)) return NextResponse.json({ error: 'origin_not_allowed' }, { status: 403 });
    const body = await request.json();
    if (!body?.paymentId) return NextResponse.json({ error: 'payment_id_required' }, { status: 400 });

    const method = normalizePayPalMethod(body.paymentMethod);
    const payerName = typeof body.payerName === 'string' ? body.payerName.trim().slice(0, 300) : '';
    const payerEmail = typeof body.payerEmail === 'string' ? body.payerEmail.trim().toLowerCase().slice(0, 254) : '';
    const order = await createPayPalOrderForPayment(String(body.paymentId), method, {
      name: payerName,
      email: payerEmail,
    });
    return NextResponse.json({ id: order.orderId, orderId: order.orderId, amountUsd: order.amountUsd });
  } catch (error) {
    console.error('[PayPal Create Order]', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Impossible de créer l'ordre PayPal.",
    }, { status: 400 });
  }
}
