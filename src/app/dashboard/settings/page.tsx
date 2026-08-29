import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { SettingsClient } from "./settings-client";
import { createAdminClient } from "@/utils/supabase/admin";

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { user, merchant, userRole } = await getCurrentUserAndMerchant();
  const supabase = createAdminClient();

  const { data: dbUser, error: userError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  if (userError) {
    console.error("Error fetching dbUser:", userError);
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('*')
    .eq('merchant_id', merchant.id)
    .maybeSingle();

  const { data: members } = await supabase
    .from('merchant_members')
    .select('*')
    .eq('merchant_id', merchant.id)
    .order('created_at', { ascending: false });

  // Fetch merchant owner details
  const { data: ownerUser } = await supabase
    .from('users')
    .select('email, first_name, last_name')
    .eq('id', merchant.user_id)
    .maybeSingle();

  const ownerMember = ownerUser ? [{
    id: 'owner-' + merchant.user_id,
    email: ownerUser.email,
    role: 'owner',
    status: 'active',
    created_at: merchant.created_at || new Date().toISOString(),
    isOwner: true
  }] : [];

  const filteredMembers = (members || []).filter((m: any) => m.email?.toLowerCase() !== ownerUser?.email?.toLowerCase());
  const allMembers = [...ownerMember, ...filteredMembers];

  return (
    <SettingsClient 
      user={dbUser} 
      merchant={merchant} 
      settings={settings} 
      members={allMembers} 
      userRole={userRole}
    />
  );
}
