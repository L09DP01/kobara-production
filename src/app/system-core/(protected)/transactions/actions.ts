'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { onPaymentSucceeded } from '@/lib/server/payments/on-payment-succeeded';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string, maxLength: number) {
  return String(formData.get(key) || '').trim().slice(0, maxLength);
}

function transactionUrl(id: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  return `/system-core/transactions/${id}?${search.toString()}`;
}

export async function updatePendingPayment(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations']);
  const paymentId = value(formData, 'payment_id', 36);
  if (!UUID_PATTERN.test(paymentId)) redirect('/system-core/transactions?error=invalid_payment');

  const status = String(formData.get('status') || '');
  if (!['succeeded', 'failed'].includes(status) || formData.get('confirmed') !== 'yes') {
    redirect(transactionUrl(paymentId, { edit: '1', error: 'status' }));
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from('payments')
    .select('id, merchant_id, status, environment, reference_code, external_reference, payment_method, metadata')
    .eq('id', paymentId)
    .eq('environment', 'live')
    .maybeSingle();

  if (readError || !current) redirect(transactionUrl(paymentId, { error: 'not_found' }));
  if (current.status !== 'pending') redirect(transactionUrl(paymentId, { error: 'not_pending' }));

  const changes = {
    status,
    ...(status === 'succeeded' ? { paid_at: new Date().toISOString() } : {}),
  };

  const { data: updated, error: updateError } = await admin
    .from('payments')
    .update(changes)
    .eq('id', paymentId)
    .eq('environment', 'live')
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (updateError || !updated) redirect(transactionUrl(paymentId, { error: 'update_failed' }));

  const { error: auditError } = await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    merchant_id: current.merchant_id,
    action: 'payment.status_corrected',
    entity_type: 'payments',
    entity_id: paymentId,
    metadata: {
      before: { status: current.status },
      after: { status },
      changed_by: session.user.email,
    },
  });

  let followupFailed = false;
  if (auditError) console.error('[Core] Payment correction audit failed', { paymentId });
  if (status === 'succeeded') {
    try {
      await onPaymentSucceeded(paymentId);
    } catch {
      followupFailed = true;
      console.error('[Core] Payment correction follow-up failed', { paymentId });
    }
  }
  revalidatePath('/system-core/transactions');
  revalidatePath(`/system-core/transactions/${paymentId}`);
  revalidatePath(`/system-core/merchants/${current.merchant_id}`);
  redirect(transactionUrl(paymentId, { saved: '1', ...(auditError || followupFailed ? { warning: 'followup' } : {}) }));
}
