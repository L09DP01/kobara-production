'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { upgradeMerchantPlan } from '@/lib/server/plans';

const allowedStatuses = new Set(['contact_required', 'merchant_contacted', 'kyb_pending', 'kyb_in_progress', 'information_required', 'approved', 'rejected']);

export async function updateBusinessRequestAction(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations', 'compliance']);
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '');
  const adminNotes = String(formData.get('admin_notes') || '').trim() || null;
  if (!id || !allowedStatuses.has(status)) throw new Error('Mise à jour invalide.');
  const now = new Date().toISOString();
  const update: Record<string, any> = { status, admin_notes: adminNotes };
  if (status === 'merchant_contacted') update.contacted_at = now;
  if (status === 'kyb_in_progress') update.kyb_started_at = now;
  if (status === 'approved') update.kyb_approved_at = now;
  const admin = createAdminClient();
  const { data, error } = await admin.from('business_plan_requests').update(update).eq('id', id).select('merchant_id').single();
  if (error) throw new Error(error.message);
  await admin.from('audit_logs').insert({ admin_id: session.user.id, merchant_id: data.merchant_id, action: `business_request.${status}`, entity_type: 'business_plan_requests', entity_id: id, metadata: { admin_notes: adminNotes } });
  revalidatePath('/system-core/business-requests');
}

export async function activateBusinessPlanAction(formData: FormData) {
  const session = await requireAdmin(['super_admin', 'operations']);
  const id = String(formData.get('id') || '');
  const admin = createAdminClient();
  const { data: request, error } = await admin.from('business_plan_requests').select('merchant_id, status, kyb_approved_at').eq('id', id).single();
  if (error || !request) throw new Error('Demande introuvable.');
  if (request.status !== 'approved' || !request.kyb_approved_at) throw new Error('Le KYB doit être approuvé avant l’activation Business.');
  await upgradeMerchantPlan(request.merchant_id, 'business', { amountHTG: 0, paymentStatus: 'not_required', source: 'admin', paymentLabel: 'validation KYB' });
  await admin.from('business_plan_requests').update({ status: 'plan_activated', activated_at: new Date().toISOString() }).eq('id', id);
  await admin.from('audit_logs').insert({ admin_id: session.user.id, merchant_id: request.merchant_id, action: 'business_plan.activated', entity_type: 'business_plan_requests', entity_id: id });
  revalidatePath('/system-core/business-requests');
  revalidatePath('/system-core/subscriptions');
}
