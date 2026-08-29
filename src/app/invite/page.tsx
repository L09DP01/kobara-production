import { createAdminClient } from "@/utils/supabase/admin";
import InviteClient from "./invite-client";
import { redirect } from "next/navigation";

export default async function InvitePage({
  searchParams
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const params = await searchParams;
  const token = params.token as string;

  if (!token) {
    redirect("/");
  }

  const supabase = createAdminClient();
  
  // Verify token
  const { data: member, error } = await supabase
    .from('merchant_members')
    .select('id, email, status, role, merchants(business_name)')
    .eq('id', token)
    .single();

  if (error || !member) {
    return (
      <div className="min-h-screen bg-[#0F1626] flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-4xl text-red-500 mb-4">error</span>
          <h1 className="text-xl font-bold text-white mb-2">Invitation invalide</h1>
          <p className="text-slate-400">Ce lien d'invitation n'existe pas ou a expiré.</p>
        </div>
      </div>
    );
  }

  if (member.status === 'active') {
    return (
      <div className="min-h-screen bg-[#0F1626] flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-4xl text-emerald-500 mb-4">check_circle</span>
          <h1 className="text-xl font-bold text-white mb-2">Invitation déjà acceptée</h1>
          <p className="text-slate-400 mb-6">Vous avez déjà accepté cette invitation.</p>
          <a href="/login" className="bg-orange-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-orange-600 transition-colors inline-block">Se connecter</a>
        </div>
      </div>
    );
  }

  // Check if user already exists
  const { data: user } = await supabase.from('users').select('id').eq('email', member.email).maybeSingle();
  const userExists = !!user;

  const roleLabel = member.role === 'admin' ? 'Administrateur' : 'Développeur';

  return (
    <InviteClient 
      token={token}
      email={member.email}
      businessName={(member.merchants as any)?.business_name || 'Kobara'}
      userExists={userExists}
      roleLabel={roleLabel}
    />
  );
}
