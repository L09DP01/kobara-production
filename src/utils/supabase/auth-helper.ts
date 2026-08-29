import { auth } from "@/auth";
import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function getCurrentUserAndMerchant() {
  const session = await auth() as any;
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  const supabaseAdmin = createAdminClient();
  const cookieStore = await cookies();
  const activeMerchantId = cookieStore.get('kobara_active_merchant')?.value;

  let merchant = null;
  let userRole = 'owner';

  // If a specific merchant is selected via switcher
  if (activeMerchantId) {
    // Check if user is owner of this merchant
    const { data: ownerMerchant } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("id", activeMerchantId)
      .eq("user_id", user.id)
      .maybeSingle();
      
    if (ownerMerchant) {
      merchant = ownerMerchant;
      userRole = 'owner';
    } else {
      // Check if user is a member of this merchant
      const { data: membership } = await supabaseAdmin
        .from('merchant_members')
        .select('role, merchants(*)')
        .eq('merchant_id', activeMerchantId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (membership && membership.merchants) {
        merchant = membership.merchants as any;
        userRole = membership.role || 'developer';
      }
    }
  }

  // Fallback if no specific merchant selected or selection is invalid
  if (!merchant) {
    // Try their owned merchant
    const { data: ownedMerchant } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (ownedMerchant) {
      merchant = ownedMerchant;
      userRole = 'owner';
    } else {
      // Try any member merchant
      const { data: firstMembership } = await supabaseAdmin
        .from('merchant_members')
        .select('role, merchants(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (firstMembership && firstMembership.merchants) {
        merchant = firstMembership.merchants as any;
        userRole = firstMembership.role || 'developer';
      }
    }
  }

  if (!merchant || (userRole === 'owner' && (!merchant.phone || !merchant.category))) {
    redirect("/onboarding");
  }

  // Auto-expire pending payments older than 24 hours
  await expireMerchantOldPayments(merchant.id);

  // Sync subscription lifecycle with immediate effect for this merchant
  try {
    const { syncSubscriptionLifecycle } = await import("@/lib/server/plans");
    await syncSubscriptionLifecycle(merchant.id);

    // The lifecycle sync may have downgraded or reactivated this account.
    // Refresh the row so the current request immediately sees the effective plan.
    const { data: refreshedMerchant, error: refreshError } = await supabaseAdmin
      .from('merchants')
      .select('*')
      .eq('id', merchant.id)
      .maybeSingle();
    if (refreshError) console.error('Merchant refresh after subscription sync failed:', refreshError.message);
    else if (refreshedMerchant) merchant = refreshedMerchant;
  } catch (e) {
    console.error("Subscription sync failed:", e);
  }

  // Create an RLS-enabled client for the current user
  const supabase = createClient(cookieStore, session?.supabaseAccessToken);

  return { user, merchant, userRole, supabase };
}

export async function expireMerchantOldPayments(merchantId: string) {
  try {
    const supabaseAdmin = createAdminClient();
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    // Get all pending payments older than 24 hours for this merchant
    const { data: expiredPayments } = await supabaseAdmin
      .from('payments')
      .select('id, amount, kobara_reference, net_amount, currency, environment')
      .eq('merchant_id', merchantId)
      .eq('status', 'pending')
      .lt('created_at', yesterday.toISOString());

    if (expiredPayments && expiredPayments.length > 0) {
      const expiredIds = expiredPayments.map(p => p.id);
      
      // Claim only rows that are still pending so the cron and dashboard cannot
      // dispatch the same expiration concurrently.
      const { data: claimedPayments, error: claimError } = await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .in('id', expiredIds)
        .eq('status', 'pending')
        .select('id');

      if (claimError) throw claimError;
      const claimedIds = new Set((claimedPayments || []).map(payment => payment.id));
      const paymentsToNotify = expiredPayments.filter(payment => claimedIds.has(payment.id));
      if (paymentsToNotify.length === 0) return;

      // Create notifications for the merchant
      const notifications = paymentsToNotify.map(p => ({
        merchant_id: merchantId,
        type: 'payment_failed',
        title: '❌ Paiement expiré',
        message: `Un paiement en attente de ${p.amount} HTG (Réf: ${p.kobara_reference}) a expiré après 24h sans validation.`
      }));

      await supabaseAdmin.from('notifications').insert(notifications);

      const { dispatchMerchantWebhook } = await import('@/lib/server/webhooks/dispatcher');
      await Promise.allSettled(paymentsToNotify.map(payment => dispatchMerchantWebhook({
        merchantId,
        environment: payment.environment === 'live' ? 'live' : 'test',
        eventType: 'payment.failed',
        data: {
          id: payment.id,
          reference: payment.kobara_reference,
          amount: payment.amount,
          net_amount: payment.net_amount || payment.amount,
          currency: payment.currency || 'HTG',
          status: 'failed',
          reason: 'expired',
        },
      })));
    }
  } catch (e) {
    console.error("Error auto-expiring payments:", e);
  }
}
