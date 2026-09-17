import { NextResponse } from 'next/server';

import { verifyNowPaymentsSignature } from '@/lib/nowpayments';
import {
  applyNowPaymentsStatus,
  getNowPaymentsPayment,
  type NowPaymentsPayment,
} from '@/lib/server/payments/nowpayments';

export async function POST(request: Request) {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET?.trim();
  if (!secret) {
    console.error('[NOWPayments IPN] NOWPAYMENTS_IPN_SECRET is missing.');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  let payload: NowPaymentsPayment;
  try {
    payload = await request.json() as NowPaymentsPayment;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!verifyNowPaymentsSignature(
    payload,
    request.headers.get('x-nowpayments-sig'),
    secret,
  )) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  if (!payload.payment_id || !payload.order_id) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  try {
    const verifiedPayment = await getNowPaymentsPayment(String(payload.payment_id));
    if (String(verifiedPayment.payment_id) !== String(payload.payment_id)
        || verifiedPayment.order_id !== payload.order_id) {
      return NextResponse.json({ error: 'provider_mismatch' }, { status: 409 });
    }
    await applyNowPaymentsStatus(verifiedPayment);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[NOWPayments IPN] Processing failed:', error);
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
