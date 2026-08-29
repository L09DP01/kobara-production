import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { parseNatcashSMS } from "@/lib/server/sms/natcash-parser";
import { getRecordedPaymentProcessor } from "@/lib/payment-routing";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate the Webhook
    const authHeader = request.headers.get('Authorization');
    const expectedSecret = process.env.SMS_GATEWAY_SECRET;
    
    if (!expectedSecret) {
      console.error("ERREUR CRITIQUE: SMS_GATEWAY_SECRET n'est pas configuré dans les variables d'environnement.");
      return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { raw_message, sender } = body;
    if (!raw_message) {
      return NextResponse.json({ error: "Missing raw_message" }, { status: 400 });
    }

    const { isSmsGatewayActive } = await import("@/lib/server/payments/gateway");
    const acceptLegacySmsPayments = await isSmsGatewayActive();

    const supabase = createAdminClient();
    
    // 2. Parse the SMS
    const parsed = await parseNatcashSMS(raw_message);
    
    if (!parsed) {
      // Save as ignored/failed parsing
      await supabase.from('sms_inbox').insert({
        raw_message,
        source: 'natcash',
        status: 'failed',
        error_reason: 'Failed to parse NatCash format'
      });
      return NextResponse.json({ success: false, reason: "Parse failed" }, { status: 200 });
    }

    // Check if TransCode already exists (prevent double processing)
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('trans_code', parsed.transCode)
      .maybeSingle();

    if (existingPayment) {
      // Already processed
      await supabase.from('sms_inbox').insert({
        raw_message,
        parsed_json: parsed,
        source: 'natcash',
        status: 'ignored',
        error_reason: 'TransCode already used',
        payment_id: existingPayment.id
      });
      return NextResponse.json({ success: true, ignored: true, reason: "Already processed" }, { status: 200 });
    }

    // 3. Find matching payment
    let matchedPayment = null;
    let errorReason = null;
    let status = 'pending';

    // Format validation: must be 8 alphanumeric characters (e.g. TVP8K3B2)
    const isValidFormat = parsed.referenceCode && /^[A-Z0-9]{8}$/i.test(parsed.referenceCode);

    if (!parsed.referenceCode || !isValidFormat) {
      errorReason = parsed.referenceCode ? 'Format de code invalide' : 'Aucun code extrait';
      status = 'ignored'; // Auto ignore
    } else {
      // Search for pending natcash payments to match by reference_code
      const { data: pendingPayments } = await supabase
        .from('payments')
        .select('id, amount, status, expires_at, merchant_id, reference_code, kobara_reference, provider, payment_method, metadata')
        .eq('status', 'pending')
        .in('provider', ['natcash', 'kobara']);

      let matchedPaymentDetails = null;

      if (pendingPayments && pendingPayments.length > 0) {
        const normalize = (s: string) => (s || '').toUpperCase().replace(/[O0]/g, '0').replace(/[I1L]/g, '1');
        const normalizedParsedRef = normalize(parsed.referenceCode);
        
        // Match against reference_code (the short NatCash code like TVP8K3B2)
        matchedPaymentDetails = pendingPayments.find((p) => {
          const explicitlySms = p.metadata?.payment_processor === 'sms_gateway';
          const legacySms =
            !p.metadata?.payment_processor &&
            acceptLegacySmsPayments &&
            getRecordedPaymentProcessor(p) === 'sms_gateway';

          return (
            (explicitlySms || legacySms) &&
            normalize(p.reference_code) === normalizedParsedRef
          );
        });
      }

      if (matchedPaymentDetails) {
        const p = matchedPaymentDetails;
        
        if (parsed.amount === null) {
          errorReason = 'Montant introuvable dans le SMS tronqué';
          status = 'failed';
        } else {
          // Allow a small tolerance (1 HTG) for rounding issues or slight overpayments
          const amountDiff = Math.abs(p.amount - parsed.amount);
          
          if (amountDiff > 1) {
            // Amount mismatch (difference > 1 HTG)
            errorReason = `Montant incorrect: Attendu ${p.amount}, Reçu ${parsed.amount}`;
            status = 'failed';
          } else {
            // Check expiration
            const now = new Date();
            const expiresAt = new Date(p.expires_at);
            if (now > expiresAt) {
              errorReason = 'Paiement expiré avant réception du SMS';
              status = 'failed';
              await supabase.from('payments').update({ status: 'expired' }).eq('id', p.id);
            } else {
              // MATCH!
              matchedPayment = p;
              status = 'processed';
            }
          }
        }
        
        // Save SMS matched
        await supabase.from('sms_inbox').insert({
          raw_message,
          parsed_json: parsed,
          source: 'natcash',
          status: status,
          error_reason: errorReason,
          payment_id: p.id
        });

        // If matched successfully, update payment
        if (matchedPayment) {
          const { data: updatedNatcashPayments, error: updateError } = await supabase.from('payments').update({
            status: 'succeeded',
            paid_at: new Date().toISOString(),
            trans_code: parsed.transCode
          }).eq('id', matchedPayment.id).neq('status', 'succeeded').select();

          if (updateError) {
            throw updateError;
          }
          
          if (!updatedNatcashPayments || updatedNatcashPayments.length === 0) {
             console.log(`Natcash Webhook deduplicated: Payment ${matchedPayment.id} already succeeded`);
          } else {
             // Centralized post-success handler (balance, webhooks, notifications, plan upgrade)
             const { onPaymentSucceeded } = await import('@/lib/server/payments/on-payment-succeeded');
             await onPaymentSucceeded(matchedPayment.id);
          }
          
          return NextResponse.json({ success: true, processed: true, payment_id: matchedPayment.id }, { status: 200 });
        } else {
          return NextResponse.json({ success: true, processed: false, reason: errorReason }, { status: 200 });
        }
      } else {
        // No pending payment found for this code
        // Auto ignore
        errorReason = `Aucun paiement en attente pour le code ${parsed.referenceCode}`;
        status = 'ignored';
      }
    }

    // Save ignored/failed SMS that didn't match any payment
    await supabase.from('sms_inbox').insert({
      raw_message,
      parsed_json: parsed,
      source: 'natcash',
      status: status,
      error_reason: errorReason
    });

    return NextResponse.json({ success: true, processed: false, reason: errorReason }, { status: 200 });

  } catch (error) {
    console.error("NatCash Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
