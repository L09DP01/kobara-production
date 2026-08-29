import DashboardLayoutClient from "@/components/dashboard/dashboard-layout-client";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { EnvironmentProvider } from "@/context/EnvironmentContext";
import { ensureCurrentSessionIsAllowed } from "@/app/dashboard/settings/sessions-actions";
import { getMerchantSubscriptionEntitlement } from '@/lib/server/plans';
import type { SubscriptionEntitlement } from '@/lib/server/subscription-entitlement';

// Pages inside /dashboard that are publicly accessible (no login required)
const PUBLIC_DASHBOARD_PATHS = ["/dashboard/developers"];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await auth();

  // Determine the current path to check if it's a public dashboard page
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isPublicDashboardPath = PUBLIC_DASHBOARD_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  let merchant = null;
  let dbUser = null;
  let notifications = [];
  const user = session?.user as any;

  let accessibleMerchants: any[] = [];
  let userRole = 'owner';
  let subscriptionEntitlement: SubscriptionEntitlement | null = null;
  let isTelegramLinked = false;

  if (user) {
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

    if (merchant) {
      const subscriptionAccess = await getMerchantSubscriptionEntitlement(merchant.id);
      subscriptionEntitlement = subscriptionAccess.entitlement;
      merchant = { ...merchant, ...subscriptionAccess.merchant };
      
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('merchant_id', merchant.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(10);
      notifications = notifs || [];

      // Vérifier si le compte est déjà lié à Telegram
      const { data: telegramLink } = await supabase
        .from('merchant_telegram_accounts')
        .select('id')
        .eq('merchant_id', merchant.id)
        .maybeSingle();

      isTelegramLinked = !!telegramLink;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("first_name, last_name, email")
      .eq("id", user.id)
      .maybeSingle();

    if (userData) {
      dbUser = userData;
    }
  }

  // For protected pages: redirect non-authenticated or non-merchants
  if (!user && !isPublicDashboardPath) {
    redirect("/logout");
  }

  if (user && (!merchant || !merchant.phone || !merchant.category) && !isPublicDashboardPath) {
    redirect("/onboarding");
  }

  if (user && merchant && !isPublicDashboardPath) {
    const sessionCheck = await ensureCurrentSessionIsAllowed((session as any)?.authMethod || 'password');
    if (!sessionCheck.allowed) {
      redirect("/logout");
    }
  }

  let hasPasskey = false;

  // -------------------------------------------------------------
  // DUAL-METHOD 2FA SECURITY ENFORCEMENT INTERCEPTION
  // -------------------------------------------------------------
  if (merchant && !isPublicDashboardPath) {
    const supabase = createAdminClient();
    const { data: settings } = await supabase
      .from("settings")
      .select("*")
      .eq("merchant_id", merchant.id)
      .maybeSingle();

    const securityJson = settings?.security_json || {};
    const twoFactorMethod = securityJson.two_factor_method || 'none';
    const passkeys = securityJson.passkeys || [];
    hasPasskey = Array.isArray(passkeys) && passkeys.length > 0;
    if (!hasPasskey && user?.id) {
      const { count: legacyPasskeyCount } = await supabase
        .from('user_passkeys')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      hasPasskey = Number(legacyPasskeyCount || 0) > 0;
    }
    const hasEmail2faCookie = cookieStore.get('kbr_2fa_email_ok')?.value === 'true';

    if (twoFactorMethod === 'totp') {
      const hasTotp2faCookie = cookieStore.get('kbr_2fa_totp_ok')?.value === 'true';
      if (!hasTotp2faCookie) {
        redirect('/login/challenge-totp');
      }
    } else if (twoFactorMethod === 'email') {
      if (!hasEmail2faCookie) {
        redirect('/login/challenge-email');
      }
    } else {
      // Step-Up MFA adaptatif : Si nouvelle IP ou nouvel appareil détecté
      if (!hasEmail2faCookie && user) {
        const { headers } = await import('next/headers');
        const headersList = await headers();
        const { LoginSecurityService } = await import('@/lib/server/security/login-context');
        const context = LoginSecurityService.extractContext(headersList);
        const evalResult = await LoginSecurityService.evaluateLoginContext({
          merchantId: merchant.id,
          userId: user.id,
          context,
        });

        if (evalResult.requiresChallenge) {
          redirect('/login/challenge-email');
        }
      }
    }
  }

  // -------------------------------------------------------------
  // CONTROLE D'ACCES REVERIFY_REQUIRED (COMPTE A EN RE-VERIFICATION)
  // -------------------------------------------------------------
  if (merchant && merchant.account_access === 'reverify_required') {
    const isAllowedPath = pathname === '/dashboard/kyc' ||
      pathname === '/dashboard/support' ||
      pathname === '/dashboard/settings';

    if (!isAllowedPath) {
      redirect('/dashboard/kyc');
    }
  }

  // -------------------------------------------------------------
  // CONTROLE D'ACCES CLOSURE_PENDING_PAYOUT (COMPTE B DUPLIQUE)
  // -------------------------------------------------------------
  if (merchant && (merchant.account_access === 'closure_pending_payout' || merchant.account_access === 'closure_pending')) {
    const { ClosurePayoutView } = await import("@/components/dashboard/ClosurePayoutView");
    
    // Récupérer le dossier de fraude et les détails éventuels
    const supabase = createAdminClient();
    const { data: fraudCase } = await supabase
      .from('kyc_fraud_cases')
      .select('payout_status, payout_details, payout_deadline_at')
      .or(`primary_merchant_id.eq.${merchant.id},related_merchant_id.eq.${merchant.id}`)
      .order('created_at', { ascending: false })
      .maybeSingle();

    return (
      <ClosurePayoutView
        merchantEmail={merchant.email}
        merchantName={merchant.business_name}
        availableBalance={Number(merchant.available_balance || 0)}
        payoutStatus={fraudCase?.payout_status || 'pending_instructions'}
        payoutDetails={fraudCase?.payout_details || {}}
        payoutDeadline={fraudCase?.payout_deadline_at}
        supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@kobara.app"}
        supportPhone={process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+509 3100 0000"}
      />
    );
  }

  // -------------------------------------------------------------
  // VÉRIFICATION DE SÉCURITÉ : COMPTE SUSPENDU / PERMANENTLY CLOSED
  // -------------------------------------------------------------
  const isSuspended = merchant && (
    merchant.account_access === 'suspended' ||
    merchant.account_access === 'permanently_closed' ||
    merchant.kyc_status === 'suspended' ||
    merchant.status === 'suspended'
  );

  if (isSuspended) {
    const { SuspendedAccountView } = await import("@/components/dashboard/SuspendedAccountView");
    return (
      <SuspendedAccountView
        merchantEmail={merchant.email}
        merchantName={merchant.business_name}
        supportPhone={process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+509 3100 0000"}
        supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@kobara.app"}
      />
    );
  }

  // For public dashboard pages: render without sidebar if no merchant
  return (
    <EnvironmentProvider>
      <DashboardLayoutClient
        merchant={merchant ?? undefined}
        user={dbUser}
        isGuest={!merchant}
        initialNotifications={notifications}
        accessibleMerchants={accessibleMerchants}
        userRole={userRole}
        hasPasskey={hasPasskey}
        subscriptionEntitlement={subscriptionEntitlement}
        isTelegramLinked={isTelegramLinked}
      >
        {children}
      </DashboardLayoutClient>
    </EnvironmentProvider>
  );
}
