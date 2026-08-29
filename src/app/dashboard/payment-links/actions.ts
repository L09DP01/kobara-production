'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from "crypto";

export async function createPaymentLink(formData: FormData) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();

  const title = formData.get('title') as string;
  const amountStr = formData.get('amount') as string;
  const description = formData.get('description') as string;

  if (!title) {
    return { error: "Le titre est requis" };
  }

  const amount = amountStr ? parseFloat(amountStr) : null;

  const collectPhone = formData.get('collect_phone') === 'true';
  const collectAddress = formData.get('collect_address') === 'true';
  const passFeesToCustomer = formData.get('pass_fees_to_customer') === 'true';
  const productName = formData.get('product_name') as string;
  const productImage = formData.get('product_image') as string;
  const shippingFeeStr = formData.get('shipping_fee') as string;
  const shippingFee = shippingFeeStr ? parseFloat(shippingFeeStr) : 0;

  const metadata = {
    collect_phone: collectPhone,
    collect_address: collectAddress,
    pass_fees_to_customer: passFeesToCustomer,
    ...(productName && { product_name: productName }),
    ...(productImage && { product_image: productImage }),
    ...(collectAddress && shippingFee > 0 && { shipping_fee: shippingFee })
  };

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from('payment_links')
    .insert({
      merchant_id: merchant.id,
      environment: merchant.current_environment || 'test',
      title,
      amount,
      description,
      status: 'active',
      slug: crypto.randomUUID().replace(/-/g, '').substring(0, 10),
      currency: 'HTG',
      metadata
    });

  if (error) {
    console.error("Erreur lors de la création du lien de paiement:", error);
    return { error: "Erreur lors de la création du lien de paiement: " + error.message };
  }

  revalidatePath('/dashboard/payment-links');
  return { success: true };
}

export async function updatePaymentLink(formData: FormData) {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const adminClient = createAdminClient();

  const id = formData.get('id') as string;
  const title = formData.get('title') as string;
  const amountStr = formData.get('amount') as string;
  const description = formData.get('description') as string;

  if (!id || !title) {
    throw new Error("ID et Titre sont requis");
  }

  // Find payment link to verify ownership (with RLS, the update will just fail if they don't own it)
  // But doing a select first gives a better error message.
  const { data: linkInfo } = await supabase
    .from('payment_links')
    .select('merchant_id')
    .eq('id', id)
    .single();

  if (!linkInfo || linkInfo.merchant_id !== merchant.id) {
    throw new Error("Lien de paiement non trouvé ou accès refusé");
  }

  const amount = amountStr ? parseFloat(amountStr) : null;

  const { error } = await supabase
    .from('payment_links')
    .update({
      title,
      amount,
      description,
    })
    .eq('id', id);

  if (error) {
    console.error("Erreur lors de la modification du lien de paiement:", error);
    throw new Error("Erreur lors de la modification du lien de paiement");
  }

  revalidatePath('/dashboard/payment-links');
  redirect('/dashboard/payment-links');
}
