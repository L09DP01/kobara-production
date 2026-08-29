"use server";

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export async function inviteTeamMemberAction(formData: FormData) {
  try {
    const { merchant, userRole } = await getCurrentUserAndMerchant();
    if (userRole !== 'owner') throw new Error("Accès refusé. Seul le propriétaire peut inviter des membres.");

    const email = formData.get('email')?.toString().toLowerCase().trim();
    const role = formData.get('role')?.toString() || 'developer';
    if (!email) throw new Error("L'adresse e-mail est requise.");

    const supabase = createAdminClient();

    // Check if member already exists
    const { data: existing } = await supabase
      .from('merchant_members')
      .select('id')
      .eq('merchant_id', merchant.id)
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      throw new Error("Cet utilisateur est déjà membre ou invité.");
    }

    // Insert pending member
    const { data: newMember, error } = await supabase
      .from('merchant_members')
      .insert({
        merchant_id: merchant.id,
        email: email,
        role: role,
        status: 'pending'
      })
      .select('id')
      .single();

    if (error) throw error;

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
    const inviteLink = `${appUrl}/invite?token=${newMember.id}`;

    const { sendTeamInviteEmail } = await import('@/lib/server/mail');
    await sendTeamInviteEmail({
      to: email,
      businessName: merchant.business_name || 'Kobara',
      inviteLink,
      role
    });

    revalidatePath('/dashboard/team');
    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function removeTeamMemberAction(memberId: string) {
  try {
    const { merchant, userRole } = await getCurrentUserAndMerchant();
    if (userRole !== 'owner') throw new Error("Accès refusé.");

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('merchant_members')
      .delete()
      .eq('id', memberId)
      .eq('merchant_id', merchant.id);

    if (error) throw error;

    revalidatePath('/dashboard/team');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function resendInvitationAction(memberId: string) {
  try {
    const { merchant, userRole } = await getCurrentUserAndMerchant();
    if (userRole !== 'owner') throw new Error("Accès refusé.");

    const supabase = createAdminClient();
    const { data: member, error } = await supabase
      .from('merchant_members')
      .select('id, email, role, status')
      .eq('id', memberId)
      .eq('merchant_id', merchant.id)
      .single();

    if (error || !member) throw new Error("Membre introuvable.");
    if (member.status !== 'pending') throw new Error("Ce membre a déjà accepté l'invitation.");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
    const inviteLink = `${appUrl}/invite?token=${member.id}`;

    const { sendTeamInviteEmail } = await import('@/lib/server/mail');
    await sendTeamInviteEmail({
      to: member.email,
      businessName: merchant.business_name || 'Kobara',
      inviteLink,
      role: member.role || 'developer'
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
