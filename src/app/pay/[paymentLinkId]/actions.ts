"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- Payment rows and redirect errors are runtime-shaped. */

import { createAdminClient } from "@/utils/supabase/admin";
import { redirect } from "next/navigation";
import { getMerchantCurrentPlan } from "@/lib/server/plans";
import { createPaymentGateway, getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import {
  createPaymReference,
  normalizePaymAmount,
  withPaymentRoutingMetadata,
  sanitizePaymentRedirectUrl,
} from "@/lib/payment-routing";
import { PayPalService } from "@/lib/server/payments/paypal";

export async function processPayment(formData: FormData) {
  // Use admin client to bypass RLS for public operations
  const supabaseAdmin = createAdminClient();

  const paymentLinkId = formData.get('paymentLinkId') as string;
  const merchantId = formData.get('merchantId') as string;
  const amountStr = formData.get('amount') as string;
  const customerName = formData.get('customerName') as string;
  const customerEmail = (formData.get('customerEmail') as string || '').trim().toLowerCase();
  const customerPhone = formData.get('customerPhone') as string;
  const customerAddress = formData.get('customerAddress') as string;

  const requestedProvider = (formData.get('provider') as string || 'moncash').toLowerCase();
  const isInternational = ['carte', 'card', 'paypal', 'apple_pay', 'google_pay'].includes(requestedProvider);
  const provider = isInternational ? 'paypal' : requestedProvider;
  const paymentSource = requestedProvider === 'carte' ? 'card' : requestedProvider;

  if (provider !== 'moncash' && provider !== 'natcash' && provider !== 'paypal') {
    throw new Error("Fournisseur de portefeuille inconnu");
  }

  if (!paymentLinkId || !merchantId || !amountStr || !customerName || !customerEmail || !customerPhone) {
    throw new Error("Informations manquantes");
  }

  // 1. Fetch Payment Link to check settings
  const { data: linkInfo } = await supabaseAdmin
    .from('payment_links')
    .select('amount, metadata, environment, slug')
    .eq('id', paymentLinkId)
    .single();

  if (!linkInfo) {
    throw new Error("Lien de paiement invalide");
  }

  if (linkInfo.environment !== 'live') {
    throw new Error("Ce lien Sandbox doit etre utilise sur test.kobara.app.");
  }

  const { data: verifiedMerchant } = await supabaseAdmin
    .from('merchants')
    .select('kyc_status, status, account_access')
    .eq('id', merchantId)
    .maybeSingle();

  if (
    verifiedMerchant?.kyc_status !== 'approved'
    || verifiedMerchant.status === 'suspended'
    || ['suspended', 'permanently_closed'].includes(verifiedMerchant.account_access || '')
  ) {
    throw new Error("Ce marchand ne peut pas accepter de paiements pour le moment.");
  }

  if (isInternational) {
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, paypal_enabled, has_usd_account')
      .eq('id', merchantId)
      .maybeSingle();
    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    if (!usdAccount.isActive) {
      throw new Error("Les paiements internationaux ne sont pas disponibles pour ce marchand.");
    }
  }

  const paymentProviderConfig = await getPaymentProviderConfig();

  // Determine base amount (if link has a fixed amount, use it to avoid tampering)
  const productAmount = linkInfo.amount ? Number(linkInfo.amount) : parseFloat(amountStr);
  const shippingFee = (linkInfo.metadata?.collect_address && linkInfo.metadata?.shipping_fee) ? Number(linkInfo.metadata.shipping_fee) : 0;
  const baseAmount = productAmount + shippingFee;

  if (isNaN(baseAmount) || baseAmount < 10) {
    throw new Error("Montant invalide. Le montant minimum est de 10 HTG.");
  }
  
  const { plan } = await getMerchantCurrentPlan(merchantId);
  const feePercent = plan ? (plan.transaction_fee_percent / 100) : 0.04; // Default to 4% if no plan
  
  const passFeesToCustomer = linkInfo.metadata?.pass_fees_to_customer === true;

  let grossAmount = baseAmount;
  let feeAmount = 0;
  let netAmount = 0;

  if (passFeesToCustomer) {
    grossAmount = parseFloat((baseAmount / (1 - feePercent)).toFixed(2));
    feeAmount = parseFloat((grossAmount - baseAmount).toFixed(2));
    netAmount = baseAmount;
  } else {
    feeAmount = parseFloat((baseAmount * feePercent).toFixed(2));
    netAmount = parseFloat((baseAmount - feeAmount).toFixed(2));
    grossAmount = baseAmount;
  }

  // NatCash Merchant Pay rejects fractional HTG amounts with
  // ERR_PARAMETERS_INVALID. Keep every persisted amount aligned with the
  // integer amount sent to Pay'm so later verification remains exact.
  if (
    provider === 'natcash' &&
    paymentProviderConfig.active_provider === 'paym' &&
    !Number.isInteger(grossAmount)
  ) {
    grossAmount = normalizePaymAmount(provider, grossAmount);
    if (passFeesToCustomer) {
      feeAmount = parseFloat((grossAmount - baseAmount).toFixed(2));
      netAmount = baseAmount;
    } else {
      feeAmount = parseFloat((grossAmount * feePercent).toFixed(2));
      netAmount = parseFloat((grossAmount - feeAmount).toFixed(2));
    }
  }

  // 1. Find or Create Customer
  let customerId = null;
  let { data: existingCustomer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('environment', linkInfo.environment)
    .eq('phone', customerPhone)
    .maybeSingle();

  if (!existingCustomer) {
    const { data: customerByEmail } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('merchant_id', merchantId)
      .eq('environment', linkInfo.environment)
      .eq('email', customerEmail)
      .maybeSingle();
    existingCustomer = customerByEmail;
  }

  if (existingCustomer) {
    customerId = existingCustomer.id;
    await supabaseAdmin.from('customers').update({ name: customerName, email: customerEmail, phone: customerPhone }).eq('id', customerId);
  } else {
    const { data: newCustomer, error: createError } = await supabaseAdmin
      .from('customers')
      .insert({
        merchant_id: merchantId,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        wallet: customerPhone,
        environment: linkInfo.environment
      })
      .select('id')
      .single();
      
    if (newCustomer) {
      customerId = newCustomer.id;
    } else {
      console.error("Erreur création client public", createError);
    }
  }

  // 1.5 Fetch Merchant name for reference code prefix
  const { data: merchantData } = await supabaseAdmin.from('merchants').select('business_name').eq('id', merchantId).single();
  const businessName = merchantData?.business_name || 'KBR';
  const prefix = businessName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const getRandom = (charset: string) => charset.charAt(Math.floor(Math.random() * charset.length));
  
  const randomPart = getRandom(digits) + getRandom(letters) + getRandom(letters) + getRandom(digits) + getRandom(digits);
  let referenceCode = prefix + randomPart;

  // 1.8 Anti-boucle & Réutilisation de session : Vérifier si un paiement non réglé existe déjà pour ce client sur ce lien
  const nowIso = new Date().toISOString();
  let payment: any = null;
  let txRef: string = '';
  let isReusedPayment = false;

  if (customerId) {
    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('id, kobara_reference, reference_code, amount, fee_amount, net_amount, provider, payment_method, metadata, expires_at, status')
      .eq('merchant_id', merchantId)
      .eq('payment_link_id', paymentLinkId)
      .eq('customer_id', customerId)
      .eq('environment', linkInfo.environment)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPayment) {
      payment = existingPayment;
      txRef = existingPayment.kobara_reference;
      referenceCode = existingPayment.reference_code || referenceCode;
      isReusedPayment = true;

      // Mettre à jour les informations si le client a changé de mode ou de montant
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      await supabaseAdmin
        .from('payments')
        .update({
          amount: grossAmount,
          fee_amount: feeAmount,
          net_amount: netAmount,
          provider: provider,
          payment_method: provider,
          expires_at: expiresAt,
          metadata: {
            ...(existingPayment.metadata || {}),
            ...(customerAddress ? { address: customerAddress } : {}),
            customer_name: customerName,
            customer_email: customerEmail,
            customer_phone: customerPhone,
          }
        })
        .eq('id', existingPayment.id);
    }
  }

  // 2. Si aucun paiement en attente réutilisable n'existe, en créer un nouveau
  if (!payment) {
    const externalRef = crypto.randomUUID();
    txRef = createPaymReference('KOB');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes expiration

    const { data: newPayment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        merchant_id: merchantId,
        customer_id: customerId,
        payment_link_id: paymentLinkId,
        kobara_reference: txRef,
        reference_code: referenceCode, // Short code for SMS Gateway
        bazik_transaction_id: externalRef,
        amount: grossAmount,
        fee_amount: feeAmount,
        net_amount: netAmount,
        currency: 'HTG',
        status: 'pending',
        provider: provider, // 'moncash' or 'natcash'
        payment_method: provider,
        environment: linkInfo.environment,
        expires_at: expiresAt,
        metadata: {
          ...(customerAddress ? { address: customerAddress } : {}),
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        }
      })
      .select('id, metadata')
      .single();

    if (paymentError || !newPayment) {
      console.error("Erreur de création de paiement:", paymentError);
      throw new Error("Erreur lors de l'initialisation du paiement");
    }

    payment = newPayment;
  }

  // Determine basePath for redirects based on domain
  const { headers } = await import("next/headers");
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isPaySubdomain = host === "pay.kobara.app" || host.startsWith("pay.");
  const basePath = isPaySubdomain ? "" : "/pay";

  const publicPaymentPath = `${basePath}/${linkInfo.slug || paymentLinkId}`;
  try {
    const methodTypeValue = (formData.get('methodType') as string) || '';
    let methodType: 'web' | 'ussd' = methodTypeValue === 'ussd' ? 'ussd' : 'web';
    if (provider === 'moncash' && !methodTypeValue) {
      if (paymentProviderConfig.active_provider === 'paym' && !paymentProviderConfig.paym_moncash_web && paymentProviderConfig.paym_moncash_ussd) {
        methodType = 'ussd';
      }
    }
    if (isInternational) {
      await supabaseAdmin.from('payments').update({
        provider: 'paypal',
        payment_method: paymentSource,
        payment_source: paymentSource,
        metadata: {
          ...(payment.metadata || {}),
          payment_processor: 'paypal',
          payment_source: paymentSource,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone,
        },
      }).eq('id', payment.id).eq('status', 'pending');

      const { notifyPaymentCreated } = await import('@/lib/server/notifications');
      const { data: merchant } = await supabaseAdmin.from('merchants').select('email').eq('id', merchantId).single();
      if (merchant?.email) await notifyPaymentCreated(merchantId, merchant.email, grossAmount, 'HTG', payment.id);
      return {
        paymentId: payment.id,
        paymentMethod: paymentSource,
      };
    }

    let gatewayRes: Awaited<ReturnType<typeof createPaymentGateway>>;
    try {
      gatewayRes = await createPaymentGateway({
        amount: grossAmount,
        reference: txRef,
        provider,
        paymentMethodType: methodType,
        phoneNumber: customerPhone,
        description: `Paiement pour ${customerName}`,
        environment: 'live',
      });
    } catch (initializationError) {
      if (!isReusedPayment) {
        const { error: discardError } = await supabaseAdmin
          .from('payments')
          .delete()
          .eq('id', payment.id)
          .eq('status', 'pending');
        if (discardError) {
          console.error(JSON.stringify({ event: 'discard_uninitialized_payment_failed', payment_id: payment.id, code: discardError.code }));
        }
      }
      throw initializationError;
    }

    const safePaymentUrl = sanitizePaymentRedirectUrl(gatewayRes.paymentUrl);

    const { error: routingUpdateError } = await supabaseAdmin.from('payments').update({
      provider,
      payment_method: gatewayRes.paymentMethod,
      bazik_order_id: gatewayRes.processor === 'bazik' ? gatewayRes.orderId : null,
      metadata: {
        ...withPaymentRoutingMetadata(payment.metadata, gatewayRes.route, gatewayRes.transactionId),
        is_ussd: gatewayRes.isUssd,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        ...(gatewayRes.processor === 'paym' && safePaymentUrl
          ? { provider_checkout_url: safePaymentUrl }
          : {}),
      },
    }).eq('id', payment.id);

    if (routingUpdateError) {
      throw new Error("Impossible d'enregistrer le fournisseur du paiement");
    }

    const { notifyPaymentCreated } = await import('@/lib/server/notifications');
    try {
      const { data: mData } = await supabaseAdmin.from('merchants').select('email').eq('id', merchantId).single();
      if (mData) {
        await notifyPaymentCreated(merchantId, mData.email, grossAmount, 'HTG', payment.id);
      }
    } catch (notificationError) {
      console.error("Notification failed", notificationError);
    }

    if (gatewayRes.processor === 'sms_gateway') {
      return {
        redirectUrl: `${publicPaymentPath}/natcash?payment_id=${payment.id}`,
      };
    }

    if (gatewayRes.isUssd) {
      return {
        redirectUrl: `${basePath}/checkout/${payment.id}?mode=processing&method=${gatewayRes.paymentMethod}&phone=${encodeURIComponent(customerPhone)}`,
      };
    }

    if (safePaymentUrl) {
      console.info(JSON.stringify({
        event: 'payment_external_redirect',
        processor: gatewayRes.processor,
        wallet: provider,
        reference: txRef,
      }));
      return {
        redirectUrl: gatewayRes.processor === 'paym'
          ? `${basePath}/redirect/${payment.id}`
          : safePaymentUrl,
      };
    }

    throw new Error("Le fournisseur n'a pas retourné d'URL de paiement.");
  } catch (error: any) {
    if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.includes('NEXT_REDIRECT')) {
      throw error;
    }
    console.error("Erreur d'initialisation du paiement:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const failedProcessor = paymentProviderConfig.active_provider === 'paym'
      ? 'paym'
      : provider === 'moncash'
        ? 'bazik'
        : 'sms_gateway';
    await supabaseAdmin.from('payments').update({
      status: 'failed',
      provider,
      payment_method: provider,
      metadata: {
        ...(payment.metadata || {}),
        payment_processor: failedProcessor,
        wallet_provider: provider,
        provider_error: errorMessage,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
      },
    }).eq('id', payment.id);
    redirect(`${publicPaymentPath}?error=${encodeURIComponent(errorMessage)}`);
  }
}
