import { createAdminClient } from "@/utils/supabase/admin";
import InviteClient from "./invite-client";
import { redirect } from "next/navigation";
import { hashPartnerToken } from "@/lib/server/partners/tokens";

type MerchantRelation = { business_name?: string | null } | Array<{ business_name?: string | null }> | null;

function relationBusinessName(relation: MerchantRelation) {
  return (Array.isArray(relation) ? relation[0]?.business_name : relation?.business_name) || 'Kobara';
}

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
  
  const tokenHash = hashPartnerToken(token);
  const { data: member, error } = await supabase
    .from('merchant_members')
    .select('id, email, status, role, invite_expires_at, merchants(business_name)')
    .eq('invite_token_hash', tokenHash)
    .maybeSingle();

  if (error || !member || member.status !== 'pending' || !member.invite_expires_at || new Date(member.invite_expires_at) <= new Date()) {
    return (
      <div className="min-h-screen bg-[#0F1626] flex items-center justify-center p-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
          <span className="material-symbols-outlined text-4xl text-red-500 mb-4">error</span>
          <h1 className="text-xl font-bold text-white mb-2">Invitation invalide</h1>
          <p className="text-slate-400">Ce lien d&apos;invitation n&apos;existe pas ou a expiré.</p>
        </div>
      </div>
    );
  }

  // Check if user already exists
  const { data: user } = await supabase.from('users').select('id').ilike('email', member.email).maybeSingle();
  const userExists = !!user;

  const roleLabel = member.role === 'admin' ? 'Administrateur' : 'Développeur';

  return (
    <InviteClient 
      token={token}
      email={member.email}
      businessName={relationBusinessName(member.merchants as MerchantRelation)}
      userExists={userExists}
      roleLabel={roleLabel}
    />
  );
}
