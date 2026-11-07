'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/require-admin';
import { createAdminClient } from '@/utils/supabase/admin';
import { MAX_KNOWLEDGE_BYTES, validateKnowledgeFile } from '@/lib/kapso-support-policy';
import { updateSupportKnowledge } from '@/lib/server/whatsapp/kapso';

export async function importSupportKnowledge(_previous: { success: boolean; message: string }, formData: FormData) {
  let session;
  try { session = await requireAdmin(['super_admin']); }
  catch { return { success: false, message: 'Reconnectez-vous avec le compte du fondateur.' }; }
  const owner = process.env.KAPSO_KNOWLEDGE_OWNER_ADMIN_ID;
  const allowed = owner ? session.user.id === owner : session.user.email.toLowerCase() === 'lorvensondp4282@gmail.com';
  if (!allowed) return { success: false, message: 'Import réservé au fondateur désigné.' };
  const file = formData.get('knowledge');
  const version = Number(formData.get('version'));
  if (!(file instanceof File) || !file.size || file.size > MAX_KNOWLEDGE_BYTES || !Number.isSafeInteger(version) || version < 0) {
    return { success: false, message: 'Fichier ou version invalide. Rechargez la page.' };
  }
  if (formData.get('approved') !== 'on') return { success: false, message: 'Confirmez que le contenu est officiel et sans données personnelles ni secrets.' };
  let content;
  try { content = validateKnowledgeFile(file.name, new Uint8Array(await file.arrayBuffer())); }
  catch (error) { return { success: false, message: (error as Error).message }; }
  const audit = await createAdminClient().from('audit_logs').insert({ admin_id: session.user.id,
    action: 'whatsapp.knowledge_import_requested', entity_type: 'kapso_knowledge',
    metadata: { sha256: createHash('sha256').update(content).digest('hex'), bytes: file.size, expected_version: version },
  });
  if (audit.error) return { success: false, message: 'Journalisation indisponible. Aucun import effectué.' };
  try { await updateSupportKnowledge(content, version); }
  catch { return { success: false, message: 'Import non confirmé. Rechargez la page pour vérifier la base avant de réessayer.' }; }
  revalidatePath('/system-core/whatsapp/knowledge');
  return { success: true, message: 'Base unique mise à jour dans Kapso. Le workflow reste en brouillon.' };
}
