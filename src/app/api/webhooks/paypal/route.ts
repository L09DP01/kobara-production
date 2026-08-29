/* eslint-disable @typescript-eslint/no-explicit-any -- PayPal webhook resources are polymorphic by event type. */
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { PayPalService } from '@/lib/server/payments/paypal';
import { finalizePayPalCapture, type PayPalPaymentMethod } from '@/lib/server/payments/paypal-finalizer';

function paymentSource(resource: any, fallback?: string): PayPalPaymentMethod {
  const value = Object.keys(resource?.payment_source || {})[0] || fallback;
  return value === 'card' || value === 'apple_pay' || value === 'google_pay' ? value : 'paypal';
}

async function findPayment(resource: any) {
  const supabase = createAdminClient();
  const customId = resource?.custom_id;
  const invoiceId = resource?.invoice_id;
  const orderId = resource?.supplementary_data?.related_ids?.order_id;
  let query = supabase.from('payments').select('*');
  if (customId) query = query.eq('id', customId);
  else if (invoiceId) query = query.eq('kobara_reference', invoiceId);
  else if (orderId) query = query.eq('paypal_order_id', orderId);
  else return { payment: null, orderId: null };
  const { data: payment } = await query.maybeSingle();
  return { payment, orderId: orderId || payment?.paypal_order_id || null };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }

    const isValid = await PayPalService.verifyWebhookSignature({
      authAlgo: request.headers.get('paypal-auth-algo') || '',
      certUrl: request.headers.get('paypal-cert-url') || '',
      transmissionId: request.headers.get('paypal-transmission-id') || '',
      transmissionSig: request.headers.get('paypal-transmission-sig') || '',
      transmissionTime: request.headers.get('paypal-transmission-time') || '',
      webhookEvent: body,
    });
    if (!isValid) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });

    const eventType = body.event_type;
    const resource = body.resource || {};
    console.info(JSON.stringify({
      event: 'paypal_webhook_received',
      webhook_event_id: body.id,
      type: eventType,
      resource_id: resource.id,
      environment: PayPalService.getApiBaseUrl().includes('.sandbox.') ? 'test' : 'live',
    }));

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      // The browser capture route owns capture. This event is acknowledged only;
      // auto-capture here would race the browser and duplicate finalization.
      return NextResponse.json({ status: 'success', received: true });
    }

    const { payment, orderId } = await findPayment(resource);
    if (!payment) {
      console.warn('[PayPal Webhook] No Kobara payment matches event', body.id);
      return NextResponse.json({ status: 'ignored', reason: 'payment_not_found' });
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      if (!orderId) throw new Error("L'ordre PayPal associé est introuvable.");
      await finalizePayPalCapture({
        paymentId: payment.id,
        orderId,
        requestedMethod: paymentSource(resource, payment.payment_source),
        capture: {
          success: true,
          captureId: resource.id,
          amountUsd: Number(resource.amount?.value),
          currency: resource.amount?.currency_code,
          processorFeeUsd: resource.seller_receivable_breakdown?.paypal_fee?.value
            ? Number(resource.seller_receivable_breakdown.paypal_fee.value)
            : undefined,
          paymentSource: paymentSource(resource, payment.payment_source),
          raw: resource,
        },
      });
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.DECLINED') {
      const supabase = createAdminClient();
      const { data: failed } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)
        .eq('status', 'pending')
        .select('id, merchant_id, environment')
        .maybeSingle();
      if (failed) {
        const { dispatchMerchantWebhook } = await import('@/lib/server/webhooks/dispatcher');
        await dispatchMerchantWebhook({
          merchantId: failed.merchant_id,
          eventType: 'payment.failed',
          data: { id: failed.id, status: 'failed', reason: 'payment_capture_denied' },
          environment: failed.environment || 'live',
        });
      }
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const supabase = createAdminClient();
      const { data: refunded } = await supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('id', payment.id)
        .eq('status', 'succeeded')
        .select('id, merchant_id, environment')
        .maybeSingle();
      if (refunded) {
        const { dispatchMerchantWebhook } = await import('@/lib/server/webhooks/dispatcher');
        await dispatchMerchantWebhook({
          merchantId: refunded.merchant_id,
          eventType: 'payment.refunded',
          data: { id: refunded.id, status: 'refunded' },
          environment: refunded.environment || 'live',
        });
      }
    }

    return NextResponse.json({ status: 'success', received: true });
  } catch (error) {
    console.error('[PayPal Webhook] Processing error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'internal_server_error' }, { status: 500 });
  }
}
