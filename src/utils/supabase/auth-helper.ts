import { auth } from "@/auth";
import { createAdminClient } from "./admin";
import { createClient } from "./server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveMerchantContext } from '@/lib/server/merchant-context';

export async function getCurrentUserAndMerchant() {
  const session = await auth() as any;
  const user = session?.user;

  if (!user) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const activeMerchantId = cookieStore.get('kobara_active_merchant')?.value;
  const { merchant, userRole } = await resolveMerchantContext(user.id, activeMerchantId);
  if (!activeMerchantId && merchant) redirect('/businesses');
  if (!merchant && activeMerchantId) redirect('/businesses');

  if (!merchant || (userRole === 'owner' && (!merchant.phone || !merchant.category))) {
    redirect("/onboarding");
  }

  // Auto-expire pending payments older than 24 hours
  await expireMerchantOldPayments(merchant.id);

  // Create an RLS-enabled client for the current user
  const supabase = createClient(cookieStore, session?.supabaseAccessToken, merchant.id);

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
      .eq('environment', 'live')
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
        environment: 'live',
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
