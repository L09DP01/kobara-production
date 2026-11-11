'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';

export async function importAndPublishCgu(form: FormData) {
  const session = await requireAdmin(['super_admin']);
  const file = form.get('document');
  const title = String(form.get('title') || '').trim();
  const version = String(form.get('version') || '').trim();
  if (form.get('confirm') !== 'on' || !title || title.length > 160 || !/^[\w.-]{1,40}$/.test(version)
    || !(file instanceof File) || !/\.(txt|md)$/i.test(file.name) || file.size > 256 * 1024) {
    throw new Error('Vérifiez la version, le titre, le fichier et la confirmation.');
  }
  const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/\r\n/g, '\n').trim();
  if (!content || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) throw new Error('Document texte invalide.');
  const { error } = await createAdminClient().rpc('publish_cgu', {
    p_version: version, p_title: title, p_content: content,
    p_hash: createHash('sha256').update(content).digest('hex'), p_admin: session.user.id,
  });
  if (error) throw new Error('Publication impossible. Vérifiez que la migration est appliquée et que cette version est nouvelle.');
  revalidatePath('/terms');
  revalidatePath('/system-core/legal/cgu-rules');
}
