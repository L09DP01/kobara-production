import DashboardLayoutClient from "@/components/dashboard/dashboard-layout-client";
import { createAdminClient } from "@/utils/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { ensureCurrentSessionIsAllowed } from "@/app/dashboard/settings/sessions-actions";
import { getMerchantSubscriptionEntitlement } from '@/lib/server/plans';
import { SessionInactivityGuard } from '@/components/dashboard/session-inactivity-guard';
import type { MerchantReferralSummary } from '@/components/dashboard/merchant-referral-dialog';
import { resolveMerchantContext, merchantSwitcherOptions } from '@/lib/server/merchant-context';
import Link from 'next/link';
import { hasBusinessAccess } from '@/lib/business-creation-error';
import { maybeActivateAdditionalBusiness } from '@/lib/server/business-activation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await auth();

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isKycPath = pathname === '/kyc'
    || pathname.startsWith('/kyc/')
    || pathname === '/dashboard/kyc'
    || pathname.startsWith('/dashboard/kyc/');
  const isPreKycAllowedPath = pathname === '/dashboard'
    || pathname === '/dashboard/'
    || isKycPath
    || pathname === '/settings'
    || pathname.startsWith('/settings/')
    || pathname === '/dashboard/settings'
    || pathname.startsWith('/dashboard/settings/')
    || pathname === '/support'
    || pathname.startsWith('/support/')
    || pathname === '/dashboard/support'
    || pathname.startsWith('/dashboard/support/');

  let merchant = null;
  let dbUser = null;
  let notifications = [];
  const user = session?.user as any;

  let accessibleMerchants: any[] = [];
  let userRole = 'owner';
  let isTelegramLinked = false;
  let referralSummary: MerchantReferralSummary | null = null;

  if (user) {
    const supabase = createAdminClient();
    const activeMerchantId = cookieStore.get('kobara_active_merchant')?.value;
    
    const context = await resolveMerchantContext(user.id, activeMerchantId);
    if (!activeMerchantId && context.merchant) redirect('/businesses');
    accessibleMerchants = context.accessibleMerchants;
    merchant = context.merchant;
    if (merchant && context.userRole === 'owner') merchant = await maybeActivateAdditionalBusiness(merchant);
    const currentMerchant = merchant;
    if (currentMerchant) accessibleMerchants = accessibleMerchants.map(item => item.id === currentMerchant.id ? { ...item, ...currentMerchant } : item);
    userRole = context.userRole || 'owner';

    if (merchant) {
      let isKycApproved = merchant.kyc_status === 'approved';

      if (merchant.identity_owner_merchant_id) {
        const owner = await supabase.from('merchants').select('user_id, kyc_status, status, account_access')
          .eq('id', merchant.identity_owner_merchant_id).maybeSingle();
        if (owner.error) throw new Error('business_identity_lookup_failed');
        isKycApproved = isKycApproved && merchant.business_verification_status === 'approved'
          && owner.data?.user_id === merchant.user_id && owner.data?.kyc_status === 'approved'
          && owner.data?.status === 'active' && hasBusinessAccess(owner.data?.account_access);
        if (!isKycApproved && merchant.kyc_status === 'approved') merchant = { ...merchant, kyc_status: 'in_review' };
      }

      if (isKycApproved && (merchant.kyc_status !== 'approved' || merchant.current_environment !== 'live')) {
        const verifiedAt = merchant.kyc_verified_at || new Date().toISOString();
        await supabase
          .from('merchants')
          .update({
            kyc_status: 'approved',
            kyc_verified_at: verifiedAt,
            current_environment: 'live',
          })
          .eq('id', merchant.id);

        merchant = {
          ...merchant,
          kyc_status: 'approved',
          kyc_verified_at: verifiedAt,
          current_environment: 'live',
        };
      }

      // Financial data, notifications and integrations are loaded only after KYC.
      if (isKycApproved) {
        const subscriptionAccess = await getMerchantSubscriptionEntitlement(merchant.id);
        merchant = { ...merchant, ...subscriptionAccess.merchant, current_environment: 'live' };

        const { data: notifs } = await supabase
          .from('notifications')
          .select('*')
          .eq('merchant_id', merchant.id)
          .is('read_at', null)
          .order('created_at', { ascending: false })
          .limit(10);
        notifications = notifs || [];

        const { data: telegramLink } = await supabase
          .from('merchant_telegram_accounts')
          .select('id')
          .eq('merchant_id', merchant.id)
          .maybeSingle();

        isTelegramLinked = !!telegramLink;

        if (userRole === 'owner' && merchant.referral_code) {
          const [referralsResult, rewardsResult, ownPaymentsResult] = await Promise.all([
            supabase.from('merchant_referrals').select('id', { count: 'exact', head: true }).eq('referrer_merchant_id', merchant.id),
            supabase.from('partner_commission_ledger').select('amount').eq('beneficiary_type', 'merchant_referral').eq('merchant_id', merchant.id).eq('entry_type', 'merchant_referral_reward').eq('currency', 'HTG').eq('status', 'paid'),
            supabase.from('payments').select('amount').eq('merchant_id', merchant.id).eq('environment', 'live').eq('currency', 'HTG').in('status', ['succeeded', 'success', 'completed']).or('payment_link_id.not.is.null,api_key_id.not.is.null').or('api_key_origin.is.null,api_key_origin.neq.developer'),
          ]);

          referralSummary = {
            code: merchant.referral_code,
            invitedCount: referralsResult.count || 0,
            earnedHtg: (rewardsResult.data || []).reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
            ownQualifyingHtg: (ownPaymentsResult.data || []).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
          };
        }
      }
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

  if (!user) {
    redirect("/logout");
  }

  if (user && !merchant && cookieStore.get('kobara_active_merchant')?.value) redirect('/businesses');
  if (user && (!merchant || !merchant.phone || !merchant.category)) {
    redirect("/onboarding");
  }

  if (user && merchant) {
    const sessionCheck = await ensureCurrentSessionIsAllowed((session as any)?.authMethod || 'password');
    if (!sessionCheck.allowed) {
      redirect("/logout");
    }
  }

  let hasPasskey = false;

  // -------------------------------------------------------------
  // DUAL-METHOD 2FA SECURITY ENFORCEMENT INTERCEPTION
  // -------------------------------------------------------------
  if (merchant) {
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
    if (!isKycPath) {
      redirect('/kyc');
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
      <>
        <SessionInactivityGuard />
        {accessibleMerchants.length > 1 && <Link href="/businesses?choose=1" className="block bg-[#07101D] p-4 text-sm text-orange-400">Changer de business</Link>}
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
      </>
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
      <>
        <SessionInactivityGuard />
        {accessibleMerchants.length > 1 && <Link href="/businesses?choose=1" className="block bg-[#07101D] p-4 text-sm text-orange-400">Changer de business</Link>}
        <SuspendedAccountView
          merchantEmail={merchant.email}
          merchantName={merchant.business_name}
          supportPhone={process.env.NEXT_PUBLIC_SUPPORT_PHONE || "+509 3100 0000"}
          supportEmail={process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@kobara.app"}
        />
      </>
    );
  }

  const isKycApproved = merchant?.kyc_status === 'approved';
  if (merchant && !isKycApproved && !isPreKycAllowedPath) {
    redirect('/dashboard');
  }

  return (
    <>
      <SessionInactivityGuard />
      <DashboardLayoutClient
        merchant={merchant ?? undefined}
        user={dbUser}
        isGuest={!merchant}
        initialNotifications={notifications}
        accessibleMerchants={merchantSwitcherOptions(accessibleMerchants)}
        userRole={userRole}
        hasPasskey={hasPasskey}
        isTelegramLinked={isTelegramLinked}
        kycApproved={isKycApproved}
        referralSummary={referralSummary}
      >
        {merchant?.shopify_review_mode === true && <div role="status" className="border-b border-amber-800 bg-amber-950/20 p-4 text-sm text-amber-200">Démonstration Shopify : KYC simulé, paiements Test uniquement. Aucun fonds réel, aucun retrait, aucun e-mail Kobara.</div>}
        {children}
      </DashboardLayoutClient>
    </>
  );
}
