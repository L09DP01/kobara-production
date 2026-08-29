'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function processFailedPayment(reference: string) {
  if (!reference) return { success: false, error: "No reference provided" };

  const supabase = createAdminClient();

  if (reference.startsWith('UPGRADE::')) {
    return { success: false, error: "Upgrade failed" };
  }

  // Find the payment
  const { data: payment, error: fetchError } = await supabase
    .from('payments')
    .select('*')
    .eq('kobara_reference', reference)
    .single();

  if (fetchError || !payment) {
    return { success: false, error: "Payment not found" };
  }

  if (payment.status === 'failed' || payment.status === 'cancelled') {
    return { success: true, alreadyProcessed: true, redirectUrl: payment.error_url };
  }

  // Update status to failed
  const newStatus = "failed";

  const { error: updateError } = await supabase
    .from('payments')
    .update({
      status: newStatus,
    })
    .eq('id', payment.id);

  if (updateError) {
    return { success: false, error: "Failed to update payment status" };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/payments');

  return { success: true, redirectUrl: payment.error_url };
}
