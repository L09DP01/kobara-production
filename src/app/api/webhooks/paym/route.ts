import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import { confirmPaymPayment } from '@/lib/server/payments/confirm-paym-payment';
import { createAdminClient } from '@/utils/supabase/admin';

function readString(body: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = body[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await request.json() as Record<string, unknown>;
  }

  const form = await request.formData();
  return Object.fromEntries(form.entries()) as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parsePayload(request);
    const reference = readString(body, ['refference_id', 'reference_id', 'reference', 'merchant_reference']);
    const transactionId = readString(body, ['transaction_id', 'id_transaction', 'transactionId']);

    if (!reference && !transactionId) {
      return NextResponse.json({ received: false, error: 'Missing payment reference' }, { status: 400 });
    }

    const eventKey = `${reference || 'none'}:${transactionId || 'none'}`;
    const eventId = `paym:${createHash('sha256').update(eventKey).digest('hex')}`;
    const supabase = createAdminClient();
    const { error: auditError } = await supabase.from('incoming_webhook_events').insert({
      event_id: eventId,
      provider: 'paym',
      payload: body,
      status: 'processing',
    });

    if (auditError?.code === '23505') {
      const { data: existing } = await supabase
        .from('incoming_webhook_events')
        .select('status')
        .eq('event_id', eventId)
        .maybeSingle();
      if (existing?.status === 'processed') {
        return NextResponse.json({ received: true, duplicate: true });
      }
    } else if (auditError) {
      console.error(JSON.stringify({ event: 'paym_webhook_audit_failed', code: auditError.code }));
    }

    // Intercepter les retraits (Withdrawals) si la référence commence par WTH
    if (reference && reference.startsWith('WTH')) {
      const { data: withdrawal } = await supabase
        .from('withdrawals')
        .select('*')
        .eq('kobara_reference', reference)
        .maybeSingle();

      if (withdrawal) {
        const rawStatus = String(body.status || body.trans_status || body.state || '').toLowerCase();
        const isSuccess = rawStatus === 'ok' || rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'successful' || body.status === true;
        const isFailure = rawStatus === 'no' || rawStatus === 'failed' || rawStatus === 'cancelled' || rawStatus === 'rejected' || body.status === false;

        if (isSuccess) {
          await supabase.rpc('complete_automatic_withdrawal', {
            p_withdrawal_id: withdrawal.id,
            p_provider_transaction_id: transactionId || null,
            p_provider_response: body,
          });

          const { data: mData } = await supabase.from('merchants').select('email').eq('id', withdrawal.merchant_id).single();
          if (mData?.email) {
            const { notifyWithdrawalSuccess } = await import('@/lib/server/notifications');
            await notifyWithdrawalSuccess(withdrawal.merchant_id, mData.email, Number(withdrawal.total || withdrawal.amount));
          }
        } else if (isFailure) {
          await supabase.rpc('fail_and_refund_withdrawal', {
            p_withdrawal_id: withdrawal.id,
            p_reason: `Échec du retrait via Pay'm webhook (${rawStatus || 'failed'})`,
            p_provider_response: body,
          });

          const { data: mData } = await supabase.from('merchants').select('email').eq('id', withdrawal.merchant_id).single();
          if (mData?.email) {
            const { notifyWithdrawalFailed } = await import('@/lib/server/notifications');
            await notifyWithdrawalFailed(withdrawal.merchant_id, mData.email, Number(withdrawal.total || withdrawal.amount));
          }
        }

        await supabase
          .from('incoming_webhook_events')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('event_id', eventId);

        return NextResponse.json({ received: true, processed: true, type: 'withdrawal' });
      }
    }

    const result = await confirmPaymPayment({ reference, transactionId });
    const processed = result.status === 'succeeded';

    await supabase
      .from('incoming_webhook_events')
      .update({
        status: processed ? 'processed' : result.status,
        processed_at: processed ? new Date().toISOString() : null,
      })
      .eq('event_id', eventId);

    const responseStatus = result.status === 'not_found'
      ? 404
      : result.status === 'invalid' || result.status === 'failed'
        ? 400
        : result.status === 'pending'
          ? 202
          : 200;

    return NextResponse.json({
      received: true,
      processed,
      status: result.status,
      message: result.message,
    }, { status: responseStatus });
  } catch (error) {
    console.error(JSON.stringify({
      event: 'paym_webhook_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return NextResponse.json({ received: false, error: 'Webhook processing failed' }, { status: 500 });
  }
}
