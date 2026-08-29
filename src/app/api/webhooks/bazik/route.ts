import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
// For bypassing RLS when saving webhook updates since Bazik request isn't authenticated as a merchant
import { createServerClient } from "@supabase/ssr";
import crypto from "crypto";
import { getRecordedPaymentProcessor } from "@/lib/payment-routing";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("X-Bazik-Signature");
    const rawBody = await request.text();

    const secret = process.env.BAZIK_WEBHOOK_SECRET;
    
    if (!secret || !signature) {
      return NextResponse.json({ error: "Missing signature or secret" }, { status: 401 });
    }

    const expectedSignature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (signature !== expectedSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    // Bazik might use reference or referenceId
    const reference = body.reference || body.referenceId || body.reference_id;
    const status = body.status;
    const transaction_id = body.transaction_id || body.transactionId || body.id;

    if (!reference) {
      console.error("Webhook error: Missing reference in body", body);
      return NextResponse.json({ error: "Missing reference" }, { status: 400 });
    }

    const eventId = transaction_id || reference || crypto.randomUUID();
    const redisLockKey = `webhook_event:bazik:${eventId}`;

    // 1. Redis Fast Dedup
    const { safeRedis } = await import("@/lib/server/redis");
    const lockAcquired = await safeRedis(async (redis) => {
      return await redis.set(redisLockKey, "processing", { nx: true, ex: 604800 }); // 7 days expiration for webhook lock
    }, null);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabaseAdmin = createServerClient(supabaseUrl, supabaseServiceKey, {
      cookies: {
        getAll() { return [] },
        setAll() { }
      }
    });

    // 2. Postgres Source of Truth & Audit
    const { error: auditError } = await supabaseAdmin.from('incoming_webhook_events').insert({
      event_id: `bazik:${eventId}`,
      provider: 'bazik',
      payload: body,
      status: 'processing'
    });

    if (auditError) {
      if (auditError.code === '23505') {
        const { data: existingEvent } = await supabaseAdmin
          .from('incoming_webhook_events')
          .select('status')
          .eq('event_id', `bazik:${eventId}`)
          .maybeSingle();
        if (existingEvent?.status === 'processed') {
          console.log(`Webhook deduplicated via Postgres for event_id: bazik:${eventId}`);
          return NextResponse.json({ received: true });
        }
      }
      // If other DB error, we log but continue since Redis lock might be our safety net.
      console.error("Webhook audit insertion failed:", auditError);
    } else if (lockAcquired !== "OK") {
       // If lock wasn't acquired but insertion succeeded, it means Redis was down or key was deleted. Proceed normally.
    }

    // Legacy subscription references did not create a payment intent and cannot
    // be reconciled securely. New subscription purchases use the standard
    // payment path below and are activated only after their stored payment succeeds.
    if (reference.startsWith('UPGRADE::')) {
      console.error('Rejected untracked legacy subscription payment:', reference);
      return NextResponse.json({ error: 'Untracked subscription payment' }, { status: 409 });
    }

    // Intercepter les retraits (Withdrawals)
    if (reference.startsWith('WTH')) {
      const { data: withdrawal, error: fetchError } = await supabaseAdmin
        .from('withdrawals')
        .select('*')
        .eq('kobara_reference', reference)
        .single();

      if (fetchError || !withdrawal) {
        console.error(`Webhook error: Withdrawal not found for reference ${reference}`);
        return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
      }

      const bazikStatus = String(status).toUpperCase();
      const isSuccess = bazikStatus === "SUCCESS" || bazikStatus === "COMPLETED" || bazikStatus === "SUCCESSFUL" || status === true;
      const isFailure = bazikStatus === "FAILED" || bazikStatus === "CANCELLED" || bazikStatus === "REJECTED" || status === false;

      if (isSuccess) {
        await supabaseAdmin.rpc('complete_automatic_withdrawal', {
          p_withdrawal_id: withdrawal.id,
          p_provider_transaction_id: transaction_id || withdrawal.bazik_transaction_id,
          p_provider_response: body,
        });

        const { data: merchantData } = await supabaseAdmin.from('merchants').select('email').eq('id', withdrawal.merchant_id).single();
        if (merchantData?.email) {
          const { notifyWithdrawalSuccess } = await import("@/lib/server/notifications");
          await notifyWithdrawalSuccess(withdrawal.merchant_id, merchantData.email, Number(withdrawal.total || withdrawal.amount));
        }
      } else if (isFailure) {
        await supabaseAdmin.rpc('fail_and_refund_withdrawal', {
          p_withdrawal_id: withdrawal.id,
          p_reason: `Échec du retrait via Bazik (${bazikStatus})`,
          p_provider_response: body,
        });

        const { data: merchantData } = await supabaseAdmin.from('merchants').select('email').eq('id', withdrawal.merchant_id).single();
        if (merchantData?.email) {
          const { notifyWithdrawalFailed } = await import("@/lib/server/notifications");
          await notifyWithdrawalFailed(withdrawal.merchant_id, merchantData.email, Number(withdrawal.total || withdrawal.amount));
        }
      }

      return NextResponse.json({ received: true });
    }

    // Find the payment
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('kobara_reference', reference)
      .single();

    if (fetchError || !payment) {
      console.error(`Webhook error: Payment not found for reference ${reference}`);
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (getRecordedPaymentProcessor(payment) !== 'bazik') {
      console.error(`Rejected Bazik webhook for non-Bazik payment ${payment.id}`);
      return NextResponse.json({ error: "Payment processor mismatch" }, { status: 409 });
    }

    if (payment.metadata?.is_subscription_upgrade) {
      const providerAmount = Number(body.amount ?? body.total_amount ?? body.transaction_amount);
      const expectedAmount = Number(payment.metadata.expected_amount ?? payment.amount);
      if (Number.isFinite(providerAmount) && Math.abs(providerAmount - expectedAmount) > 0.01) {
        console.error('Subscription payment amount mismatch', { reference, providerAmount, expectedAmount });
        return NextResponse.json({ error: 'Payment amount mismatch' }, { status: 400 });
      }
    }

    // Determine new status
    let newStatus = payment.status;
    let paidAt = payment.paid_at;

    const bazikStatus = String(status).toUpperCase();
    // SUCCESS, COMPLETED, SUCCESSFUL, or just true if boolean
    if (bazikStatus === "SUCCESS" || bazikStatus === "COMPLETED" || bazikStatus === "SUCCESSFUL" || status === true) {
      newStatus = "succeeded";
      paidAt = new Date().toISOString();
    } else if (bazikStatus === "FAILED" || bazikStatus === "CANCELLED" || status === false) {
      newStatus = "failed";
    }

    // Update payment with optimistic locking
    const { data: updatedPayments, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: newStatus,
        bazik_transaction_id: transaction_id || payment.bazik_transaction_id,
        paid_at: paidAt
      })
      .eq('id', payment.id)
      .neq('status', newStatus) // Prevent double-crediting if concurrent request already updated it
      .select();

    if (updateError) {
      throw updateError;
    }

    // If payment was already processed by a concurrent request, updatedPayments will be empty
    if (!updatedPayments || updatedPayments.length === 0) {
      console.log(`Webhook deduplicated via optimistic locking: Payment ${payment.id} already has status ${newStatus}`);
      if (newStatus === 'succeeded' && payment.metadata?.is_subscription_upgrade) {
        const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
        await onPaymentSucceeded(payment.id);
      }
      await supabaseAdmin
        .from('incoming_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_id', `bazik:${eventId}`);
      return NextResponse.json({ received: true });
    }

    // If payment succeeded, use centralized handler for balance, webhooks, notifications
    if (newStatus === "succeeded") {
      const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
      await onPaymentSucceeded(payment.id);
    } else if (newStatus === "failed" && payment.status !== "failed") {
      const { data: merchantData } = await supabaseAdmin.from('merchants').select('email').eq('id', payment.merchant_id).single();
      if (merchantData?.email) {
        const { notifyPaymentFailed } = await import("@/lib/server/notifications");
        await notifyPaymentFailed(payment.merchant_id, merchantData.email, Number(payment.amount), payment.currency || 'HTG');
      }
    }


    await supabaseAdmin
      .from('incoming_webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('event_id', `bazik:${eventId}`);

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
