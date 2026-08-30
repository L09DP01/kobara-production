import { NextRequest, NextResponse } from "next/server";
import { authenticateApiRequest } from "@/lib/server/auth/api-auth";
import { createAdminClient } from "@/utils/supabase/admin";
import { checkPlanRateLimit } from "@/lib/server/security/rate-limit";
import { getMerchantCurrentPlan } from "@/lib/server/plans";
import {
  createPaymentGateway,
  CreatePaymentGatewayResult,
  getPaymentProviderConfig,
} from "@/lib/server/payments/gateway";
import {
  createPaymReference,
  normalizePaymAmount,
  PaymentRoutingError,
  resolveApiCheckoutUrl,
  withPaymentRoutingMetadata,
  sanitizePaymentRedirectUrl,
} from "@/lib/payment-routing";

import { PaymentCreatePayloadSchema } from "@/lib/server/validators";

import { canCreatePayment } from "@/lib/server/access";
import { getPublicApiCorsHeaders } from "@/lib/http/api-cors";
import { PayPalService } from "@/lib/server/payments/paypal";

export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getPublicApiCorsHeaders(request.headers.get('origin'));
  if (!corsHeaders) {
    return NextResponse.json({ error: 'CORS origin not allowed' }, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  try {
    const { merchantId, environment, error: authError } = await authenticateApiRequest(request);

    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const accessCheck = await canCreatePayment(merchantId, 'live');
    if (!accessCheck.allowed) {
      const expired = accessCheck.reason === 'subscription_expired';
      const message = expired
        ? "Votre abonnement a expiré. Les limites du plan gratuit sont maintenant appliquées. Renouvelez votre abonnement pour continuer."
        : accessCheck.reason === 'payment_limit_reached'
          ? "La limite mensuelle de paiements de votre plan est atteinte. Changez de plan pour continuer."
          : accessCheck.reason === 'kyc_required'
            ? "La vérification du compte est requise avant d'accepter des paiements en mode Live."
            : "Votre compte ne dispose pas d'un plan permettant de créer ce paiement.";
      console.warn(JSON.stringify({
        event: 'api_payment_access_denied',
        merchant_id: merchantId,
        environment,
        reason: accessCheck.reason,
      }));
      return NextResponse.json({
        status: 'error',
        error: message,
        message,
        code: expired ? 'SUBSCRIPTION_EXPIRED' : accessCheck.reason,
        reason: accessCheck.reason,
        renewal_url: expired || accessCheck.reason === 'payment_limit_reached'
          ? 'https://dashboard.kobara.app/billing'
          : undefined,
      }, { status: 403 });
    }

    const { merchant, plan } = await getMerchantCurrentPlan(merchantId);
    const planSlug = plan?.slug || merchant?.plan_slug || 'free';

    const rateLimitResult = await checkPlanRateLimit(merchantId, planSlug);
    if (!rateLimitResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      return NextResponse.json({ 
        error: "Rate limit exceeded. Upgrade your plan for higher limits.",
        code: "RATE_LIMIT_EXCEEDED",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      }, { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString()
        }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validationResult = PaymentCreatePayloadSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: "Validation Error", details: validationResult.error.issues }, { status: 400 });
    }

    const { amount, currency, provider: rawProvider, description, success_url, cancel_url, metadata, customer } = validationResult.data;

    // Normalize provider and requested method
    const isCard = ['carte', 'card', 'paypal', 'apple_pay', 'google_pay'].includes(rawProvider);
    const provider: 'moncash' | 'natcash' | 'carte' | 'kobara' = isCard
      ? 'carte'
      : rawProvider.startsWith('moncash')
        ? 'moncash'
        : rawProvider.startsWith('natcash')
          ? 'natcash'
        : 'kobara';

    if (isCard) {
      const usdAccount = await PayPalService.getMerchantUsdAccountState({ id: merchantId });
      if (!usdAccount.isActive) {
        return NextResponse.json({
          status: 'error',
          error: 'usd_account_inactive',
          code: 'USD_ACCOUNT_INACTIVE',
          message: "Le compte USD du marchand n'est pas créé, activé ou disponible.",
        }, { status: 403 });
      }
    }
    
    const explicitlyRequestedUssd = rawProvider.includes('ussd');

    // Idempotency check
    const idempotencyKey = request.headers.get('idempotency-key');
    if (!idempotencyKey) {
      return NextResponse.json({
        error: "idempotency_key_required",
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "L'en-tête Idempotency-Key est obligatoire pour créer un paiement.",
        required_header: "Idempotency-Key",
        example: "Idempotency-Key: 8f3d4e2a-93c2-4c0f-bbe0-95ab31f6d712",
      }, { status: 400 });
    }

    const { checkIdempotency, saveIdempotencyResponse } = await import('@/lib/server/security/idempotency');
    const idempotencyResult = await checkIdempotency(merchantId, idempotencyKey, '/api/v1/payments', body);

    if (idempotencyResult.status === 'cached') {
      return NextResponse.json(idempotencyResult.response, { 
        status: idempotencyResult.statusCode,
        headers: {
          'Idempotency-Key': idempotencyKey,
          'X-Idempotency-Cached': 'true'
        }
      });
    }

    if (idempotencyResult.status === 'conflict') {
      return NextResponse.json({ error: "idempotency_key_conflict", message: idempotencyResult.error }, { status: 409 });
    }

    const idempotencyKeyId = idempotencyResult.keyId;

    // Connect to Supabase
    const supabase = createAdminClient();

    // 1. Generate a unique Kobara Reference
    const kobaraReference = createPaymReference('KOB');

    let bazikOrderId = null;
    let natcashReferenceCode = null;
    let paymentUrl = null;
    let gatewayResult: CreatePaymentGatewayResult | null = null;
    const paymentProviderConfig = await getPaymentProviderConfig();
    const paymentAmount = provider === 'natcash' && paymentProviderConfig.active_provider === 'paym'
      ? normalizePaymAmount('natcash', amount)
      : amount;

    // Generate the short reference only for a direct NatCash request. Unified
    // checkout generates it later if the customer actually chooses NatCash.
    if (provider === 'natcash') {
      const { data: merchantData } = await supabase.from('merchants').select('business_name').eq('id', merchantId).single();
      const businessName = merchantData?.business_name || 'KBR';
      const prefix = businessName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const digits = '0123456789';
      const getRandom = (charset: string) => charset.charAt(Math.floor(Math.random() * charset.length));
      
      const randomPart = getRandom(digits) + getRandom(letters) + getRandom(letters) + getRandom(digits) + getRandom(digits);
      natcashReferenceCode = prefix + randomPart;
    }

    // Call external payment APIs (live mode only)
    if (environment === 'live' && (provider === 'moncash' || provider === 'natcash' || provider === 'carte')) {
      const isPaym = paymentProviderConfig.active_provider === 'paym';
      const isMoncashUssd = isPaym && provider === 'moncash' && (explicitlyRequestedUssd || (!paymentProviderConfig.paym_moncash_web && paymentProviderConfig.paym_moncash_ussd));
      const hasValidPhone = Boolean(customer?.phone && /^(\+?509)?[34]\d{7}$/.test(customer.phone.replace(/\D/g, '')));

      // If only USSD is enabled/requested and no valid phone was provided in the API call,
      // skip direct gateway creation so the API returns checkout_url for the customer to enter their phone on Kobara checkout.
      // Card and wallet sessions require the persisted Kobara payment id. They
      // are initialized from the hosted checkout after this row is created.
      const shouldCallGateway = provider !== 'carte' && !(isMoncashUssd && !hasValidPhone);

      if (shouldCallGateway) {
        try {
          const paymentMethodType = isMoncashUssd ? 'ussd' : 'web';
          gatewayResult = await createPaymentGateway({
            amount: paymentAmount,
            reference: kobaraReference,
            provider,
            paymentMethodType,
            phoneNumber: customer?.phone || undefined,
            description: description || "Paiement Kobara API",
            environment: 'live',
            successUrl: success_url,
            cancelUrl: cancel_url,
            errorUrl: cancel_url,
          });

          bazikOrderId = gatewayResult.processor === 'bazik' ? gatewayResult.orderId : null;
          paymentUrl = sanitizePaymentRedirectUrl(gatewayResult.paymentUrl);
        } catch (apiErr: unknown) {
          console.error("Payment gateway API v1 creation error:", apiErr);
          const status = apiErr instanceof PaymentRoutingError ? 400 : 502;
          const message = apiErr instanceof Error ? apiErr.message : "Erreur de communication";
          return NextResponse.json(
            { error: `Erreur du fournisseur de paiement: ${message}` },
            { status },
          );
        }
      }
    }

    // 2.5 Resolve Customer
    let customerId = null;
    if (customer) {
      const { name, email, phone } = customer;
      
      let existingCustomer = null;
      if (email) {
        const { data } = await supabase
          .from('customers')
          .select('id')
          .eq('merchant_id', merchantId)
          .eq('environment', environment)
          .eq('email', email)
          .maybeSingle();
        if (data) existingCustomer = data;
      }
      
      if (!existingCustomer && phone) {
        const { data: existingCustomerData } = await supabase
          .from('customers')
          .select('id')
          .eq('merchant_id', merchantId)
          .eq('environment', environment)
          .eq('phone', phone)
          .maybeSingle();
        if (existingCustomerData) existingCustomer = existingCustomerData;
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        // Mettre à jour si de nouvelles infos sont fournies
        const updates: Record<string, string> = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        
        if (Object.keys(updates).length > 0) {
          await supabase.from('customers').update(updates).eq('id', customerId);
        }
      } else {
        const { data: newCustomer, error: createError } = await supabase
          .from('customers')
          .insert({
            merchant_id: merchantId,
            environment: environment,
            name: name || 'Client inconnu',
            email: email || null,
            phone: phone || null,
            wallet: phone || null
          })
          .select('id')
          .single();
          
        if (newCustomer) {
          customerId = newCustomer.id;
        } else {
          console.error("Erreur création client API", createError);
        }
      }
    }

    // 3. Save pending payment to DB
    const feePercent = plan ? (plan.transaction_fee_percent / 100) : 0.04;
    
    const feeAmount = parseFloat((paymentAmount * feePercent).toFixed(2));
    const netAmount = parseFloat((paymentAmount - feeAmount).toFixed(2));

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    const { data: payment, error: dbError } = await supabase.from('payments').insert({
      merchant_id: merchantId,
      environment: environment,
      customer_id: customerId,
      kobara_reference: kobaraReference,
      reference_code: natcashReferenceCode,
      bazik_order_id: bazikOrderId,
      amount: paymentAmount,
      fee_amount: feeAmount,
      net_amount: netAmount,
      currency: currency,
      status: 'pending',
      provider,
      payment_method: gatewayResult?.paymentMethod || provider,
      expires_at: expiresAt,
      success_url: success_url,
      error_url: cancel_url,
      metadata: gatewayResult
        ? withPaymentRoutingMetadata(
            {
              ...(metadata || {}),
              customer_name: customer?.name,
              customer_phone: customer?.phone,
              ...(gatewayResult.processor === 'paym' && paymentUrl
                ? { provider_checkout_url: paymentUrl }
                : {}),
            },
            gatewayResult.route,
            gatewayResult.transactionId,
          )
        : {
            ...(metadata || {}),
            customer_name: customer?.name,
            customer_phone: customer?.phone,
            requested_payment_source: isCard
              ? (rawProvider === 'apple_pay' || rawProvider === 'google_pay' || rawProvider === 'paypal' ? rawProvider : 'card')
              : undefined,
          },
    }).select().single();

    if (dbError) {
      console.error("Payment insertion error:", dbError);
      return NextResponse.json({ error: "Internal Database Error" }, { status: 500 });
    }

    // Call notification service
    const { notifyPaymentCreated } = await import('@/lib/server/notifications');
    try {
      const { data: mData } = await supabase.from('merchants').select('email').eq('id', merchantId).single();
      if (mData) {
        await notifyPaymentCreated(merchantId, mData.email, paymentAmount, currency, payment.id);
      }
    } catch(e) { console.error("Notification failed", e); }

    const finalPayment = payment;

    const { headers } = await import("next/headers");
    const headersList = await headers();
    const host = headersList.get("host") || "";
    const checkoutBaseUrl = host.includes("localhost") || host.includes("127.0.0.1")
      ? `http://${host}/pay`
      : "https://pay.kobara.app";

    paymentUrl = resolveApiCheckoutUrl({
      requestedProvider: provider,
      environment: 'live',
      paymentId: finalPayment.id,
      checkoutBaseUrl,
      processor: gatewayResult?.processor,
      externalUrl: paymentUrl,
    });
    if (provider === 'carte') {
      const checkoutMethod = rawProvider === 'apple_pay' || rawProvider === 'google_pay' || rawProvider === 'paypal'
        ? rawProvider
        : 'card';
      paymentUrl += `${paymentUrl.includes('?') ? '&' : '?'}method=${checkoutMethod}`;
    }

    // 4. Return response to merchant
    const responsePayload = {
      status: "success",
      data: {
        id: finalPayment.id,
        reference: finalPayment.kobara_reference,
        amount: finalPayment.amount,
        net_amount: finalPayment.net_amount,
        fee_amount: finalPayment.fee_amount,
        status: finalPayment.status,
        environment: finalPayment.environment,
        paid_at: finalPayment.paid_at || null,
        checkout_url: paymentUrl,
        url: paymentUrl,
        payment_url: paymentUrl,
        paymentUrl: paymentUrl,
      }
    };

    // Save response for idempotency
    await saveIdempotencyResponse(idempotencyKeyId, responsePayload, 200);

    return NextResponse.json(responsePayload, {
      headers: {
        'Idempotency-Key': idempotencyKey
      }
    });

  } catch (error: unknown) {
    console.error("API Payment Error:", error);
    // If we have an idempotency key id, we should mark it failed so it can be retried safely
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await authenticateApiRequest(request);

    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const { merchant, plan } = await getMerchantCurrentPlan(merchantId);
    const planSlug = plan?.slug || merchant?.plan_slug || 'free';

    const rateLimitResult = await checkPlanRateLimit(merchantId, planSlug);
    if (!rateLimitResult.success) {
      const retryAfter = Math.max(1, Math.ceil((rateLimitResult.reset - Date.now()) / 1000));
      return NextResponse.json({ 
        error: "Rate limit exceeded. Upgrade your plan for higher limits.",
        code: "RATE_LIMIT_EXCEEDED",
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining
      }, { 
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.reset.toString()
        }
      });
    }

    const supabase = createAdminClient();

    // Fetch one extra row so API clients can stop pagination without an
    // expensive exact count over the complete payments table.
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
    const requestedOffset = Number.parseInt(searchParams.get('offset') || '0', 10);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, requestedLimit))
      : 50;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, requestedOffset)
      : 0;

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      throw error;
    }

    const rows = data || [];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      data: page,
      pagination: {
        limit,
        offset,
        count: page.length,
        has_more: hasMore,
        next_offset: hasMore ? offset + page.length : null,
      },
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.reset.toString(),
      },
    });
  } catch (error: unknown) {
    console.error("API GET Payments Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
