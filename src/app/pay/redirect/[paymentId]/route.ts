import { NextRequest, NextResponse } from 'next/server';

import { getRecordedPaymentProcessor } from '@/lib/payment-routing';
import { createAdminClient } from '@/utils/supabase/admin';

const RETURN_COOKIE = 'kobara_payment_return';

function isAllowedCheckoutUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const target = new URL(value);
    const isLocal = target.hostname === 'localhost' || target.hostname === '127.0.0.1';
    return target.protocol === 'https:' || (isLocal && target.protocol === 'http:')
      ? target
      : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;
  const supabase = createAdminClient();
  const { data: payment } = await supabase
    .from('payments')
    .select('id, status, provider, payment_method, reference_code, metadata')
    .eq('id', paymentId)
    .maybeSingle();

  if (!payment || getRecordedPaymentProcessor(payment) !== 'paym') {
    return NextResponse.redirect(new URL('/pay/error?reason=payment_not_found', request.url));
  }

  if (payment.status === 'succeeded') {
    return NextResponse.redirect(new URL(`/pay/processing?payment_id=${encodeURIComponent(payment.id)}`, request.url));
  }

  const checkoutUrl = isAllowedCheckoutUrl(payment.metadata?.provider_checkout_url);
  if (!checkoutUrl) {
    return NextResponse.redirect(new URL('/pay/error?reason=missing_payment_url', request.url));
  }

  const response = NextResponse.redirect(checkoutUrl);
  response.headers.set('Cache-Control', 'no-store');
  const sharedCookieDomain = request.nextUrl.hostname.endsWith('kobara.app')
    ? '.kobara.app'
    : undefined;
  response.cookies.set(RETURN_COOKIE, payment.id, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: request.nextUrl.protocol === 'https:' ? 'none' : 'lax',
    maxAge: 10 * 60,
    path: '/',
    domain: sharedCookieDomain,
  });
  return response;
}
