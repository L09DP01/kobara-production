"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function acceptInviteAction(token: string, password?: string) {
  try {
    const supabase = createAdminClient();

    // Verify token
    const { data: member, error } = await supabase
      .from('merchant_members')
      .select('id, email, status, merchant_id, role, merchants(business_name)')
      .eq('id', token)
      .single();

    if (error || !member) throw new Error("Invitation invalide.");
    if (member.status === 'active') throw new Error("Invitation déjà acceptée.");

    // Check user
    const { data: user } = await supabase.from('users').select('id').eq('email', member.email).maybeSingle();
    let userId = user?.id;

    if (!user) {
      if (!password) throw new Error("Le mot de passe est requis pour créer votre compte.");
      if (password.length < 8) throw new Error("Le mot de passe doit faire au moins 8 caractères.");

      const password_hash = await bcrypt.hash(password, 10);
      
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: member.email,
          password_hash,
          role: 'user'
        })
        .select('id')
        .single();

      if (createError) throw new Error("Erreur lors de la création du compte : " + createError.message);
      userId = newUser.id;
    }

    // Activate member
    const { error: updateError } = await supabase
      .from('merchant_members')
      .update({
        status: 'active',
        user_id: userId
      })
      .eq('id', token);

    if (updateError) throw new Error("Erreur lors de l'activation du compte.");

    // Set kobara_active_merchant cookie
    const cookieStore = await cookies();
    cookieStore.set('kobara_active_merchant', member.merchant_id, {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      domain: process.env.NODE_ENV === 'production' ? '.kobara.app' : undefined
    });

    // Notify the merchant owner
    const businessName = (member.merchants as any)?.business_name || 'votre entreprise';
    const roleLabel = member.role === 'admin' ? 'Administrateur' : 'Développeur';
    await supabase.from('notifications').insert({
      merchant_id: member.merchant_id,
      type: 'team_member_joined',
      title: '🎉 Nouveau membre dans l\'équipe',
      message: `${member.email} a accepté l'invitation et rejoint l'équipe en tant que ${roleLabel}.`
    });

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
