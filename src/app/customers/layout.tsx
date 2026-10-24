import DashboardLayoutClient from "@/components/dashboard/dashboard-layout-client";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveMerchantContext, merchantSwitcherOptions } from '@/lib/server/merchant-context';

export default async function CustomersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await auth();

  let merchant = null;
  let dbUser = null;
  let notifications: any[] = [];
  const user = session?.user as any;

  let accessibleMerchants: any[] = [];
  let userRole = 'owner';

  if (!user) {
    redirect("/logout");
  }

  const supabase = createAdminClient();
  const activeMerchantId = cookieStore.get('kobara_active_merchant')?.value;

  const context = await resolveMerchantContext(user.id, activeMerchantId);
  if (!activeMerchantId && context.merchant) redirect('/businesses');
  accessibleMerchants = context.accessibleMerchants;
  merchant = context.merchant;
  userRole = context.userRole || 'owner';

  if (!merchant && activeMerchantId) redirect('/businesses');
  if (!merchant) {
    redirect("/onboarding");
  }

  if (merchant) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('merchant_id', merchant.id)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(10);
    notifications = notifs || [];
  }

  const { data: userData } = await supabase
    .from("users")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (userData) {
    dbUser = userData;
  }

  return (
    <DashboardLayoutClient merchant={merchant ?? undefined} user={dbUser} isGuest={!merchant} initialNotifications={notifications} accessibleMerchants={merchantSwitcherOptions(accessibleMerchants)} userRole={userRole}>
      {children}
    </DashboardLayoutClient>
  );
}
