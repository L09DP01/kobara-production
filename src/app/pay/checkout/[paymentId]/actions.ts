"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { headers } from "next/headers";
import { createPaymentGateway } from "@/lib/server/payments/gateway";
import { withPaymentRoutingMetadata, sanitizePaymentRedirectUrl } from "@/lib/payment-routing";

function isRedirectError(error: unknown) {
  if (!error || typeof error !== 'object' || !('digest' in error)) return false;
  return String(error.digest).startsWith('NEXT_REDIRECT');
}
export async function processUnifiedCheckout(formData: FormData) {
  try {
    return await processUnifiedCheckoutInternal(formData);
  } catch (error) {
    if (isRedirectError(error)) throw error;

    const message = error instanceof Error
      ? error.message
      : "Impossible d'initialiser le paiement.";
    console.error(JSON.stringify({
      event: 'unified_checkout_failed',
      message,
    }));
    return { success: false as const, error: message };
  }
}

async function processUnifiedCheckoutInternal(formData: FormData) {
  const supabaseAdmin = createAdminClient();

  const paymentId = formData.get('paymentId') as string;
  const providerValue = (formData.get('provider') as string) || 'moncash';
  const methodTypeValue = (formData.get('methodType') as string) || 'web';
  const phoneNumber = formData.get('phoneNumber') as string;

  if (providerValue !== 'moncash' && providerValue !== 'natcash' && providerValue !== 'carte' && providerValue !== 'paypal') {
    throw new Error("Fournisseur de portefeuille inconnu");
  }

  if (methodTypeValue !== 'web' && methodTypeValue !== 'ussd') {
    throw new Error("Méthode de paiement inconnue");
  }

  const provider = providerValue;
  const methodType = methodTypeValue;

  if (!paymentId) {
    throw new Error("Informations manquantes");
  }

  // Fetch Payment
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (!payment) {
    throw new Error("Paiement invalide");
  }

  if (payment.status !== 'pending') {
    throw new Error("Ce paiement n'est plus en attente");
  }

  if (payment.environment !== 'live') {
    throw new Error("Ce paiement Sandbox doit etre traite sur test.kobara.app.");
  }

  const headersList = await headers();
  const host = headersList.get("host") || "";
  const isPaySubdomain = host === "pay.kobara.app" || host.startsWith("pay.");
  const basePath = isPaySubdomain ? "" : "/pay";

  if (methodType === 'ussd') {
    const cleanPhone = (phoneNumber || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error("Veuillez saisir un numéro de téléphone MonCash valide (ex: 509 3123 4567).");
    }
  }

  const result = await createPaymentGateway({
    amount: Number(payment.amount),
    reference: payment.kobara_reference,
    provider,
    paymentMethodType: methodType,
    phoneNumber,
    environment: 'live',
    description: "Paiement Checkout Kobara",
  });

  const safePaymentUrl = sanitizePaymentRedirectUrl(result.paymentUrl);

  let natcashReferenceCode = payment.reference_code;
  if (result.processor === 'sms_gateway' && !natcashReferenceCode) {
    const { data: merchantData } = await supabaseAdmin
      .from('merchants')
      .select('business_name')
      .eq('id', payment.merchant_id)
      .single();
    const businessName = merchantData?.business_name || 'KBR';
    const prefix = businessName.toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const getRandom = (charset: string) => charset.charAt(Math.floor(Math.random() * charset.length));
    const randomPart = getRandom(digits) + getRandom(letters) + getRandom(letters) + getRandom(digits) + getRandom(digits);
    natcashReferenceCode = prefix + randomPart;
  }

  const { error: updateError } = await supabaseAdmin.from('payments').update({
    provider,
    payment_method: result.paymentMethod,
    bazik_order_id: result.processor === 'bazik' ? result.orderId : payment.bazik_order_id,
    reference_code: natcashReferenceCode,
    metadata: {
      ...withPaymentRoutingMetadata(payment.metadata, result.route, result.transactionId),
      is_ussd: result.isUssd,
      payer_phone: phoneNumber || null,
      ...(result.processor === 'paym' && safePaymentUrl
        ? { provider_checkout_url: safePaymentUrl }
        : {}),
    },
  }).eq('id', paymentId);

  if (updateError) {
    throw new Error("Impossible d'enregistrer le fournisseur du paiement");
  }

  if (result.processor === 'sms_gateway') {
    return {
      success: true as const,
      redirectUrl: `${basePath}/checkout/${paymentId}/natcash`,
    };
  }

  if (result.isUssd) {
    return {
      success: true as const,
      redirectUrl: `${basePath}/checkout/${paymentId}?mode=processing&method=${result.paymentMethod}&phone=${encodeURIComponent(phoneNumber || '')}`,
    };
  }

  if (safePaymentUrl) {
    const finalRedirectUrl = result.processor === 'paym'
      ? `${basePath}/redirect/${paymentId}`
      : safePaymentUrl;
    return {
      success: true as const,
      redirectUrl: finalRedirectUrl,
    };
  }

  return {
    success: false as const,
    error: "Le fournisseur n'a pas retourné de destination de paiement.",
  };
}
