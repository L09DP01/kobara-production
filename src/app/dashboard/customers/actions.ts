'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createCustomer(formData: { name: string, email: string, phone: string }) {
  const { merchant } = await getCurrentUserAndMerchant();
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('customers')
    .insert({
      merchant_id: merchant.id,
      environment: merchant.current_environment || 'test',
      name: formData.name,
      email: formData.email,
      phone: formData.phone
    });

  if (error) {
    throw new Error(error.message || "Erreur lors de la création du client");
  }

  revalidatePath('/dashboard/customers');
  return { success: true };
}
