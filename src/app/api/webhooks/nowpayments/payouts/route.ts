import { NextResponse } from 'next/server';
import { verifyNowPaymentsSignature } from '@/lib/nowpayments';
import {
  applyNowPaymentsPayoutStatus,
  getNowPaymentsEnvironmentValue,
  getNowPaymentsPayout,
} from '@/lib/server/payments/nowpayments';

interface PayoutIpnPayload {
  id?: string | number;
  payout_id?: string | number;
  batch_withdrawal_id?: string | number;
}

export async function POST(request: Request) {
  const secret = getNowPaymentsEnvironmentValue('NOWPAYMENTS_IPN_SECRET');
  if (!secret) return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });

  let payload: PayoutIpnPayload;
  try {
    payload = await request.json() as PayoutIpnPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!verifyNowPaymentsSignature(payload, request.headers.get('x-nowpayments-sig'), secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payoutId = String(payload.id || payload.payout_id || '').trim();
  if (!payoutId) return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  try {
    const verified = await getNowPaymentsPayout(payoutId);
    if (String(verified.id) !== payoutId) {
      return NextResponse.json({ error: 'provider_mismatch' }, { status: 409 });
    }
    await applyNowPaymentsPayoutStatus(verified);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[NOWPayments payout IPN] Processing failed:', error);
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 });
  }
}
