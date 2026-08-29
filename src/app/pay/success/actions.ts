'use server';

import { createAdminClient } from '@/utils/supabase/admin';

export async function processSuccessfulPayment(reference: string) {
  if (!reference) return { success: false, error: 'No reference provided' };

  const supabase = createAdminClient();
  const { data: payment, error } = await supabase
    .from('payments')
    .select('status, success_url')
    .eq('kobara_reference', reference)
    .maybeSingle();

  if (error || !payment) return { success: false, error: 'Payment not found' };
  if (payment.status !== 'succeeded') {
    return {
      success: false,
      pending: payment.status === 'pending',
      error: 'Le paiement attend encore la confirmation du fournisseur.',
    };
  }

  return { success: true, alreadyProcessed: true, redirectUrl: payment.success_url };
}
