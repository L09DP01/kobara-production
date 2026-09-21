"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import crypto from "crypto";
import { hashPartnerToken } from "@/lib/server/partners/tokens";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}

export async function acceptInviteAction(token: string, password?: string) {
  try {
    const supabase = createAdminClient();

    const tokenHash = hashPartnerToken(token);
    const { data: member, error } = await supabase
      .from('merchant_members')
      .select('id, email, status, merchant_id, role, invite_expires_at, merchants(business_name)')
      .eq('invite_token_hash', tokenHash)
      .maybeSingle();

    if (error || !member) throw new Error("Invitation invalide.");
    if (member.status !== 'pending' || !member.invite_expires_at || new Date(member.invite_expires_at) <= new Date()) {
      throw new Error("Cette invitation est expirée ou a déjà été utilisée.");
    }
    if (!password || password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");

    // Check user
    const { data: user } = await supabase.from('users').select('id, role, password_hash').ilike('email', member.email).maybeSingle();
    let userId = user?.id;
    let createdUser = false;
    let createdDeveloperId: string | null = null;

    if (user) {
      if (!user.password_hash) throw new Error("Ce compte ne peut pas être vérifié avec un mot de passe.");
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) throw new Error("Mot de passe incorrect.");
    } else {
      const password_hash = await bcrypt.hash(password, 10);
      userId = crypto.randomUUID();
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: member.email,
          password_hash,
          email_verified: true,
          is_active: true,
          role: member.role === 'developer' ? 'developer' : 'merchant',
        })
        .select('id')
        .single();

      if (createError) throw new Error(`Impossible de créer le compte (${createError.code || 'DB_ERROR'}).`);
      userId = newUser.id;
      createdUser = true;
    }

    if (!userId) throw new Error("Compte utilisateur introuvable.");

    if (member.role === 'developer') {
      const { data: developer } = await supabase.from('developer_accounts')
        .select('id').eq('user_id', userId).maybeSingle();
      if (!developer) {
        const displayName = member.email.split('@')[0];
        const { data: newDeveloper, error: developerError } = await supabase.from('developer_accounts').insert({
          user_id: userId,
          display_name: displayName,
          referral_code: `DEV${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
          status: 'pending',
        }).select('id').single();
        if (developerError) {
          if (createdUser) await supabase.from('users').delete().eq('id', userId);
          throw new Error(`Impossible de créer le profil Developer (${developerError.code || 'DB_ERROR'}).`);
        }
        createdDeveloperId = newDeveloper.id;
      }

      const { error: acceptError } = await supabase.rpc('accept_merchant_developer_invitation', {
        p_token_hash: tokenHash,
        p_user_id: userId,
      });
      if (acceptError) {
        if (createdDeveloperId) await supabase.from('developer_accounts').delete().eq('id', createdDeveloperId);
        if (createdUser) await supabase.from('users').delete().eq('id', userId);
        throw new Error("Impossible d'accepter cette invitation Developer.");
      }
      if (createdDeveloperId) {
        const displayName = member.email.split('@')[0];
        await supabase.from('partner_applications').insert({
          program_type: 'developer', first_name: displayName, last_name: '-', email: member.email,
          message: "Compte créé depuis une invitation d'équipe marchand.", status: 'new',
        });
      }
    } else {
      const { error: updateError } = await supabase.from('merchant_members').update({
        status: 'active', user_id: userId, accepted_at: new Date().toISOString(),
        invite_token_hash: null, invite_expires_at: null,
      }).eq('id', member.id).eq('status', 'pending');
      if (updateError) {
        if (createdUser) await supabase.from('users').delete().eq('id', userId);
        throw new Error("Erreur lors de l'activation du compte.");
      }
    }

    // Set kobara_active_merchant cookie
    const cookieStore = await cookies();
    cookieStore.set('kobara_active_merchant', member.merchant_id, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.NODE_ENV === 'production' ? '.kobara.app' : undefined
    });

    // Notify the merchant owner
    const roleLabel = member.role === 'admin' ? 'Administrateur' : 'Développeur';
    await supabase.from('notifications').insert({
      merchant_id: member.merchant_id,
      type: 'team_member_joined',
      title: '🎉 Nouveau membre dans l\'équipe',
      message: `${member.email} a accepté l'invitation et rejoint l'équipe en tant que ${roleLabel}.`
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: unknown) {
    return { error: errorMessage(error) };
  }
}
