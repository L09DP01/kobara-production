'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

export async function updateShopifyPrivacyRequest(form: FormData) {
  const session = await requireAdmin(['super_admin', 'compliance']);
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  const reference = String(form.get('reference') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['in_progress', 'completed'].includes(status)
    || (status === 'completed' && !/^[A-Za-z0-9_.:/-]{3,120}$/.test(reference))) throw new Error('Demande invalide. Utilisez une référence interne, sans données client.');
  const db = createAdminClient();
  const { data: current, error } = await db.from('shopify_privacy_requests').select('id, status, merchant_id')
    .eq('id', id).maybeSingle();
  if (error || !current || current.status === 'completed') throw new Error('Demande indisponible.');
  const result = await db.from('shopify_privacy_requests').update({
    status, assigned_to: session.user.id,
    ...(status === 'completed' ? { completed_at: new Date().toISOString(), completion_reference: reference,
      request_details_ciphertext: null } : {}),
  }).eq('id', id).eq('status', current.status).select('id').maybeSingle();
  if (result.error || !result.data) throw new Error('La demande a changé. Actualisez la page.');
  await db.from('audit_logs').insert({ admin_id: session.user.id, merchant_id: current.merchant_id,
    action: `shopify_privacy.${status}`, entity_type: 'shopify_privacy_requests', entity_id: id,
    metadata: { reference: status === 'completed' ? reference : null },
  });
  revalidatePath('/system-core/shopify-privacy');
}
