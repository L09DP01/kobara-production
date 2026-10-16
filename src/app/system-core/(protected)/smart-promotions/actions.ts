'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { isPromotionSegment } from '@/lib/smart-promotions';
import { generatePromotion, sendSmartPromotions } from '@/lib/server/messaging/smart-promotions';
import { aiChatLimiter } from '@/lib/server/security/rate-limit';

const path = '/system-core/smart-promotions';
export async function generateDraft(form: FormData) {
  const session = await requireAdmin(['super_admin', 'operations']);
  const segment = String(form.get('segment') || '');
  const limit = Number(form.get('limit'));
  if (!isPromotionSegment(segment) || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Sélection invalide.');
  const budget = await aiChatLimiter.limit(`promotion-generation:${session.user.id}`);
  let notice = 'Brouillon créé. Vérifiez le message et les destinataires avant approbation.';
  try {
    if (!budget.success) throw new Error('Rate limited');
    await generatePromotion(segment, limit, session.user.id);
  } catch { notice = 'Génération impossible. Vérifiez le consentement des destinataires, les sources et la configuration IA.'; }
  revalidatePath(path);
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}
export async function setPromotionStatus(form: FormData) {
  const session = await requireAdmin(['super_admin', 'operations']);
  const id = String(form.get('id') || '');
  const status = String(form.get('status') || '');
  if (!['approved', 'paused'].includes(status)) throw new Error('Action invalide.');
  const db = createAdminClient();
  const { error } = await db.from('smart_promotions').update({ status, approved_by: status === 'approved' ? session.user.id : undefined })
    .eq('id', id).in('status', status === 'approved' ? ['draft', 'paused'] : ['approved']);
  if (error) throw new Error('Modification impossible.');
  await db.from('audit_logs').insert({ admin_id: session.user.id, action: `smart_promotion.${status}`, entity_type: 'smart_promotions', entity_id: id });
  revalidatePath(path);
}
export async function sendApprovedPromotions() {
  await requireAdmin(['super_admin', 'operations']);
  let notice: string;
  try { const result = await sendSmartPromotions(); notice = `${result.sent} envoyés, ${result.skipped} ignorés, ${result.failed} en erreur.`; }
  catch { notice = 'Envoi indisponible. Vérifiez les migrations et la configuration e-mail.'; }
  revalidatePath(path);
  redirect(`${path}?notice=${encodeURIComponent(notice)}`);
}
