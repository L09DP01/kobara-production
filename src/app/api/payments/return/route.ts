import { NextRequest, NextResponse } from 'next/server';

import { confirmPaymPayment } from '@/lib/server/payments/confirm-paym-payment';

const RETURN_COOKIE = 'kobara_payment_return';

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

  try {
    const result = await confirmPaymPayment({ reference, transactionId, paymentId });
    const destination = result.payment
      ? `https://pay.kobara.app/processing?payment_id=${encodeURIComponent(result.payment.id)}`
      : 'https://pay.kobara.app/error?reason=payment_not_found';
    const response = NextResponse.redirect(destination, 303);
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
    return NextResponse.redirect('https://pay.kobara.app/error?reason=verification_failed', 303);
  }
}

export async function GET(request: NextRequest) {
  return handleReturn(request);
}

export async function POST(request: NextRequest) {
  return handleReturn(request);
}
