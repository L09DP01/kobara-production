import DashboardLayoutClient from "@/components/dashboard/dashboard-layout-client";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EnvironmentProvider } from "@/context/EnvironmentContext";

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

  // Fetch all owned merchants
  const { data: owned } = await supabase.from('merchants').select('*').eq('user_id', user.id);
  if (owned) accessibleMerchants.push(...owned.map((m: any) => ({ ...m, role: 'owner' })));

  // Fetch all member merchants
  const { data: memberships } = await supabase.from('merchant_members').select('role, merchants(*)').eq('user_id', user.id).eq('status', 'active');
  if (memberships) {
    accessibleMerchants.push(...memberships.map((m: any) => ({ ...m.merchants, role: m.role || 'developer' })));
  }

  // Determine current merchant
  if (activeMerchantId) {
    const selected = accessibleMerchants.find((m: any) => m.id === activeMerchantId);
    if (selected) {
      merchant = selected;
      userRole = selected.role;
    }
  }

  if (!merchant && accessibleMerchants.length > 0) {
    merchant = accessibleMerchants[0];
    userRole = accessibleMerchants[0].role;
  }

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
    <EnvironmentProvider>
      <DashboardLayoutClient merchant={merchant ?? undefined} user={dbUser} isGuest={!merchant} initialNotifications={notifications} accessibleMerchants={accessibleMerchants} userRole={userRole}>
        {children}
      </DashboardLayoutClient>
    </EnvironmentProvider>
  );
}
