import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { isReviewEmail } from '@/lib/review-account';
import { hasCloudflareEmailBinding, tryCloudflareEmail } from './email/cloudflare';
import { renderKobaraEmail } from './email/template';

export async function getPublishedCgu() {
  const { data, error } = await createAdminClient().from('legal_documents')
    .select('title, content, version, published_at').eq('doc_type', 'cgu')
    .not('published_at', 'is', null).order('published_at', { ascending: false })
    .limit(1).maybeSingle();
  if (error && error.code !== '42703' && error.code !== 'PGRST204') throw error;
  return data;
}

export async function sendCguNoticeBatch() {
  if (!hasCloudflareEmailBinding()) return { accepted: 0, review: 0, skipped: 0 };
  const db = createAdminClient();
  const counts = { accepted: 0, review: 0, skipped: 0 };
  const subject = 'Kobara : mise à jour des conditions d’utilisation';
  for (let i = 0; i < 50; i++) {
    const { data, error } = await db.rpc('claim_cgu_notice').maybeSingle<{ id: number; email: string; version: string }>();
    if (error) throw error;
    if (!data) break;
    let state: keyof typeof counts = 'skipped';
    if (!isReviewEmail(data.email)) {
      const text = `Bonjour,\n\nLes Conditions générales d’utilisation de votre compte marchand Kobara ont été mises à jour (version ${data.version}).\n\nConsultez les CGU : https://kobara.app/terms\n\nPour toute question : support@kobara.app.\n\nL’équipe Kobara`;
      const html = renderKobaraEmail({ subject, text, html: '<p>Les conditions de votre compte marchand ont été mises à jour.</p><p><a href="https://kobara.app/terms">Consulter les CGU</a></p>', kind: 'transactional' });
      const result = await tryCloudflareEmail({ to: data.email, subject, text, html });
      state = result.status === 'accepted' ? 'accepted' : 'review';
      if (result.retryableQuota) {
        const retry = await db.from('cgu_notices').update({ state: 'pending' }).eq('id', data.id);
        if (retry.error) throw retry.error;
        break;
      }
    }
    const saved = await db.from('cgu_notices').update({ state }).eq('id', data.id);
    if (saved.error) throw saved.error;
    counts[state]++;
    if (state === 'review') break;
  }
  return counts;
}
