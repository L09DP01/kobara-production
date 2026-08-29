"use server";

import { createAdminClient } from "@/utils/supabase/admin";

export async function refreshNatCashCode(paymentId: string) {
  const supabaseAdmin = createAdminClient();

  // Fetch current payment
  const { data: payment, error: fetchError } = await supabaseAdmin
    .from('payments')
    .select('merchant_id, status')
    .eq('id', paymentId)
    .single();

  if (fetchError || !payment) {
    throw new Error("Paiement introuvable");
  }
  
  if (payment.status === 'succeeded') {
    throw new Error("Ce paiement est déjà validé");
  }

  // Fetch Merchant name for reference code prefix
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
  const newReferenceCode = prefix + randomPart;

  const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      reference_code: newReferenceCode,
      expires_at: newExpiresAt,
      status: 'pending' 
    })
    .eq('id', paymentId);

  if (updateError) {
    throw new Error("Impossible de générer un nouveau code");
  }

  return {
    success: true,
    referenceCode: newReferenceCode,
    expiresAt: newExpiresAt
  };
}
