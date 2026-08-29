'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, type AdminRole } from '@/lib/auth/require-admin';
import { sendEmail } from '@/lib/server/mail';
import { createAdminClient } from '@/utils/supabase/admin';

const ADMIN_ROLES: AdminRole[] = ['super_admin', 'operations', 'compliance', 'support'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AdministratorActionResult = {
  success: boolean;
  message?: string;
  warning?: string;
  error?: string;
};

export async function createAdministrator(
  _previousState: AdministratorActionResult,
  formData: FormData,
): Promise<AdministratorActionResult> {
  try {
    const session = await requireAdmin(['super_admin']);
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const name = String(formData.get('name') || '').trim();
    const role = String(formData.get('role') || '') as AdminRole;

    if (!EMAIL_PATTERN.test(email)) return { success: false, error: 'Adresse e-mail invalide.' };
    if (!ADMIN_ROLES.includes(role)) return { success: false, error: 'Rôle administrateur invalide.' };
    if (name.length > 120) return { success: false, error: 'Le nom est trop long.' };

    const admin = createAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from('super_admins')
      .select('id, is_active')
      .ilike('email', email)
      .maybeSingle();
    if (lookupError) return { success: false, error: `Vérification impossible: ${lookupError.message}` };
    if (existing) {
      return {
        success: false,
        error: existing.is_active
          ? 'Un administrateur actif utilise déjà cette adresse.'
          : 'Cette adresse appartient à un administrateur désactivé. Réactivez ce compte dans la liste.',
      };
    }

    const { data: created, error: createError } = await admin
      .from('super_admins')
      .insert({ email, name: name || null, role, is_active: true })
      .select('id')
      .single();
    if (createError || !created) {
      const duplicate = createError?.code === '23505';
      return { success: false, error: duplicate ? 'Cette adresse est déjà enregistrée.' : `Création impossible: ${createError?.message}` };
    }

    const { error: auditError } = await admin.from('audit_logs').insert({
      admin_id: session.user.id,
      action: 'admin.created',
      entity_type: 'super_admins',
      entity_id: created.id,
      metadata: { email, role },
    });
    if (auditError) console.error('Unable to audit administrator creation:', auditError.message);

    const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app'}/system-core/login`;
    const invitation = await sendEmail({
      to: email,
      subject: 'Accès administrateur Kobara',
      text: `Bonjour${name ? ` ${name}` : ''},\n\nUn accès administrateur Kobara vous a été attribué avec le rôle ${role}. Connectez-vous avec cette adresse à la page suivante : ${loginUrl}\n\nUn code de sécurité temporaire vous sera envoyé lors de la connexion.`,
    });

    revalidatePath('/system-core/administrators');
    return invitation.success
      ? { success: true, message: 'Administrateur ajouté et invitation envoyée.' }
      : { success: true, message: 'Administrateur ajouté.', warning: `Invitation non envoyée: ${invitation.error}` };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Création impossible.' };
  }
}

export async function setAdministratorActive(id: string, activate: boolean): Promise<AdministratorActionResult> {
  try {
    const session = await requireAdmin(['super_admin']);
    if (!id) return { success: false, error: 'Administrateur introuvable.' };
    if (id === session.user.id && !activate) {
      return { success: false, error: 'Vous ne pouvez pas désactiver votre propre compte.' };
    }

    const admin = createAdminClient();
    const { data: target, error: targetError } = await admin
      .from('super_admins')
      .select('id, role, is_active')
      .eq('id', id)
      .maybeSingle();
    if (targetError) return { success: false, error: `Vérification impossible: ${targetError.message}` };
    if (!target) return { success: false, error: 'Administrateur introuvable.' };
    if (target.is_active === activate) {
      return { success: true, message: activate ? 'Le compte est déjà actif.' : 'Le compte est déjà désactivé.' };
    }

    if (!activate && target.role === 'super_admin') {
      const { count, error: countError } = await admin
        .from('super_admins')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'super_admin')
        .eq('is_active', true);
      if (countError) return { success: false, error: `Vérification impossible: ${countError.message}` };
      if ((count || 0) <= 1) {
        return { success: false, error: 'Le dernier super-administrateur actif ne peut pas être désactivé.' };
      }
    }

    const { data: updated, error: updateError } = await admin
      .from('super_admins')
      .update({ is_active: activate })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (updateError || !updated) {
      return { success: false, error: `Modification impossible: ${updateError?.message || 'aucune ligne modifiée'}` };
    }

    const { error: auditError } = await admin.from('audit_logs').insert({
      admin_id: session.user.id,
      action: activate ? 'admin.activated' : 'admin.deactivated',
      entity_type: 'super_admins',
      entity_id: id,
    });
    if (auditError) console.error('Unable to audit administrator state:', auditError.message);

    revalidatePath('/system-core/administrators');
    return { success: true, message: activate ? 'Administrateur activé.' : 'Administrateur désactivé.' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Modification impossible.' };
  }
}
