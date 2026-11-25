import { NextRequest, NextResponse } from 'next/server';

import { confirmPaymPayment } from '@/lib/server/payments/confirm-paym-payment';

const RETURN_COOKIE = 'kobara_payment_return';

function merchantUrl(value: string | null | undefined) {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function firstValue(source: Record<string, unknown> | URLSearchParams, names: string[]) {
  for (const name of names) {
    const raw = source instanceof URLSearchParams ? source.get(name) : source[name];
    if ((typeof raw === 'string' || typeof raw === 'number') && String(raw).trim()) {
      return String(raw).trim();
    }
  }
  return null;
}

async function readBody(request: NextRequest) {
  if (request.method === 'GET') return {};

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json().catch(() => ({})) as Record<string, unknown>;
  }

  const form = await request.formData().catch(() => null);
  return form ? Object.fromEntries(form.entries()) : {};
}

async function handleReturn(request: NextRequest) {
  const body = await readBody(request);
  const query = request.nextUrl.searchParams;
  const referenceNames = ['refference_id', 'reference_id', 'reference', 'merchant_reference'];
  const transactionNames = ['transaction_id', 'id_transaction', 'transactionId'];
  const paymentNames = ['payment_id', 'paymentId'];

  const reference = firstValue(query, referenceNames) || firstValue(body, referenceNames);
  const transactionId = firstValue(query, transactionNames) || firstValue(body, transactionNames);
  const paymentId = firstValue(query, paymentNames)
    || firstValue(body, paymentNames)
    || request.cookies.get(RETURN_COOKIE)?.value
    || null;

  let isApiPayment = false;
  try {
    const lookup = { reference, transactionId, paymentId };
    const result = await confirmPaymPayment(lookup);
    isApiPayment = Boolean(result.payment?.api_key_origin);
    if (isApiPayment && result.payment && result.status === 'pending') {
      const retryUrl = request.nextUrl.clone();
      retryUrl.search = '';
      retryUrl.searchParams.set('payment_id', result.payment.id);
      const expired = result.payment.expires_at !== null
        && Date.parse(result.payment.expires_at) <= Date.now();
      if (!expired) {
        const response = request.method !== 'GET' || request.nextUrl.search !== retryUrl.search
          ? NextResponse.redirect(retryUrl, 303)
          : new NextResponse(null, {
            status: 202,
            headers: { Refresh: `5; url=${retryUrl.pathname}${retryUrl.search}`, 'Retry-After': '5' },
          });
        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
      const cancelUrl = merchantUrl(result.payment.error_url);
      const response = cancelUrl
        ? NextResponse.redirect(cancelUrl, 303)
        : NextResponse.json({ status: 'expired' }, { status: 410 });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }

    const merchantDestination = merchantUrl(result.status === 'succeeded'
      ? result.payment?.success_url
      : result.status === 'failed' ? result.payment?.error_url : null);
    const destination = result.payment
      ? `https://pay.kobara.app/processing?payment_id=${encodeURIComponent(result.payment.id)}`
      : 'https://pay.kobara.app/error?reason=payment_not_found';
    const response = !isApiPayment
      ? NextResponse.redirect(destination, 303)
      : merchantDestination
        ? NextResponse.redirect(merchantDestination, 303)
        : NextResponse.json({ status: result.status, message: result.message }, {
          status: result.status === 'succeeded' ? 200 : 422,
        });
    response.headers.set('Cache-Control', 'no-store');
    response.cookies.set(RETURN_COOKIE, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 0,
      path: '/',
      domain: '.kobara.app',
    });
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: 'payment_return_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return isApiPayment
      ? NextResponse.json({ status: 'verification_unavailable' }, {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': '3' },
      })
      : NextResponse.redirect('https://pay.kobara.app/error?reason=verification_failed', 303);
  }
}

export async function GET(request: NextRequest) {
  return handleReturn(request);
}

export async function POST(request: NextRequest) {
  return handleReturn(request);
}
