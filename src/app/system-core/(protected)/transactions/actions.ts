'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REFERENCE_PATTERN = /^[A-Za-z0-9]{4,64}$/;
const EDITABLE_PAYMENT_METHODS = new Set([
  'moncash',
  'moncash_ussd',
  'natcash',
  'paypal',
  'card',
  'carte',
  'apple_pay',
  'google_pay',
  'balance',
  'kobara',
]);

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

  const referenceCode = value(formData, 'reference_code', 64).replace(/[^A-Za-z0-9]/g, '');
  const externalReference = value(formData, 'external_reference', 120);
  const paymentMethod = value(formData, 'payment_method', 20).toLowerCase();
  const customerName = value(formData, 'customer_name', 120);
  const customerPhone = value(formData, 'customer_phone', 32).replace(/[^0-9+]/g, '');

  if (!REFERENCE_PATTERN.test(referenceCode)) {
    redirect(transactionUrl(paymentId, { edit: '1', error: 'reference' }));
  }
  if (!EDITABLE_PAYMENT_METHODS.has(paymentMethod)) {
    redirect(transactionUrl(paymentId, { edit: '1', error: 'method' }));
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

  const previousMetadata = (current.metadata || {}) as Record<string, unknown>;
  const nextMetadata = {
    ...previousMetadata,
    customer_name: customerName || null,
    customer_phone: customerPhone || null,
  };
  const changes = {
    reference_code: referenceCode,
    external_reference: externalReference || null,
    payment_method: paymentMethod,
    metadata: nextMetadata,
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

  await admin.from('audit_logs').insert({
    admin_id: session.user.id,
    merchant_id: current.merchant_id,
    action: 'payment.pending_corrected',
    entity_type: 'payments',
    entity_id: paymentId,
    metadata: {
      before: {
        reference_code: current.reference_code,
        external_reference: current.external_reference,
        payment_method: current.payment_method,
        customer_name: previousMetadata.customer_name || null,
        customer_phone: previousMetadata.customer_phone || null,
      },
      after: {
        reference_code: referenceCode,
        external_reference: externalReference || null,
        payment_method: paymentMethod,
        customer_name: customerName || null,
        customer_phone: customerPhone || null,
      },
      changed_by: session.user.email,
    },
  });

  revalidatePath('/system-core/transactions');
  revalidatePath(`/system-core/transactions/${paymentId}`);
  revalidatePath(`/system-core/merchants/${current.merchant_id}`);
  redirect(transactionUrl(paymentId, { saved: '1' }));
}
