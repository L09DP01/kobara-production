import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { SettingsClient } from "./settings-client";
import { createAdminClient } from "@/utils/supabase/admin";
import { getMerchantPaymentMethodState } from "@/lib/server/payments/merchant-payment-methods";

export const dynamic = 'force-dynamic';

type DeveloperConnectionRow = { developer_id: string; [key: string]: unknown };
type TeamMemberRow = { email?: string | null; developer_account_id?: string | null; [key: string]: unknown };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const params = await searchParams;
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

  const [{ data: members }, { data: developerConnections }] = await Promise.all([
    supabase.from('merchant_members').select('*').eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
    supabase.from('developer_merchant_connections')
      .select('id, developer_id, status, withdrawal_access, connection_source, commission_eligible, developer_accounts(display_name, company_name, status), api_keys(id, name, prefix, scopes, revoked_at, created_at)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false }),
  ]);

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

  const connectionRows = (developerConnections || []) as DeveloperConnectionRow[];
  const memberRows = (members || []) as TeamMemberRow[];
  const connectionsByDeveloper = new Map(connectionRows.map((connection) => [connection.developer_id, connection]));
  const filteredMembers = memberRows
    .filter((member) => member.email?.toLowerCase() !== ownerUser?.email?.toLowerCase())
    .map((member) => ({
      ...member,
      developerConnection: member.developer_account_id ? connectionsByDeveloper.get(member.developer_account_id) || null : null,
    }));
  const allMembers = [...ownerMember, ...filteredMembers];
  const paymentMethods = await getMerchantPaymentMethodState(merchant.id);

  return (
    <SettingsClient 
      user={dbUser} 
      merchant={merchant} 
      settings={settings} 
      members={allMembers} 
      userRole={userRole}
      paymentMethods={paymentMethods}
      initialTab={params.tab}
      kycApproved={merchant.kyc_status === 'approved'}
    />
  );
}
