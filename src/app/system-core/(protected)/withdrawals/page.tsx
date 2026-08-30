import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { AdminWithdrawalsClient } from "./withdrawals-admin-client";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function AdminWithdrawalsPage() {
  const supabase = createAdminClient();

  const { data: withdrawals } = await supabase
    .from('withdrawals')
    .select(`*, merchants ( business_name, email, available_balance )`)
    .eq('environment', 'live')
    .order('created_at', { ascending: false });

  // ---- Server Actions ----

  async function approveManualWithdrawal(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const session = await requireAdmin(['super_admin', 'operations']);
    const adminClient = createAdminClient();
    const { data: result, error } = await adminClient.rpc('admin_manage_withdrawal', {
      p_withdrawal_id: id,
      p_action: 'approve',
      p_reason: null,
      p_admin_id: session.user.id,
    });
    if (error) throw new Error(error.message);

    // Le retrait manuel est approuvé, mais ne devient payé qu'après l'envoi réel.
    try {
      const { createNotification } = await import('@/lib/server/notifications');
      if (result?.merchant_id) {
        const { data: mData } = await adminClient.from('merchants').select('email').eq('id', result.merchant_id).single();
        if (mData) await createNotification(
          result.merchant_id,
          'withdrawal_approved',
          'Retrait approuvé',
          `Votre retrait de ${result.total || result.amount} ${result.currency || 'HTG'} a été approuvé et sera envoyé manuellement sous 1 à 3 jours ouvrables.`,
          mData.email,
        );
      }
    } catch(e) { console.error("Notify failed", e); }

    revalidatePath('/system-core/withdrawals');
  }

  async function rejectManualWithdrawal(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const reason = formData.get('reason') as string || 'Aucune raison spécifiée';
    const session = await requireAdmin(['super_admin', 'operations']);
    const adminClient = createAdminClient();
    const { data: result, error } = await adminClient.rpc('admin_manage_withdrawal', {
      p_withdrawal_id: id,
      p_action: 'reject',
      p_reason: reason,
      p_admin_id: session.user.id,
    });
    if (error) throw new Error(error.message);

    // 3. Notifier le marchand du rejet avec la raison (email + notification in-app)
    try {
      const { data: mData } = await adminClient.from('merchants').select('email').eq('id', result.merchant_id).single();
      if (mData?.email) {
        // Notification in-app (qui envoie aussi l'email car l'email est passé en paramètre)
        const { createNotification } = await import('@/lib/server/notifications');
        await createNotification(
          result.merchant_id,
          'withdrawal_rejected',
          '❌ Votre demande de retrait a été refusée',
          `Bonjour,\n\nVotre récente demande de retrait de ${result.total} ${result.currency || 'HTG'} a été examinée et refusée par notre équipe.\n\nRaison du refus :\n${reason}\n\nVotre solde ${result.currency || 'HTG'} a été recrédité automatiquement.\n\nCordialement,\nL'équipe Kobara`,
          mData.email
        );
      }
    } catch(e) { console.error("Reject notification failed", e); }

    revalidatePath('/system-core/withdrawals');
  }

  async function markAsPaid(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const session = await requireAdmin(['super_admin', 'operations']);
    const adminClient = createAdminClient();
    const { data: result, error } = await adminClient.rpc('admin_manage_withdrawal', {
      p_withdrawal_id: id,
      p_action: 'mark_paid',
      p_reason: null,
      p_admin_id: session.user.id,
    });
    if (error) throw new Error(error.message);

    // Notifier le marchand
    try {
      const { notifyWithdrawalSuccess } = await import('@/lib/server/notifications');
      if (result?.merchant_id) {
        const { data: mData } = await adminClient.from('merchants').select('email').eq('id', result.merchant_id).single();
        if (mData) await notifyWithdrawalSuccess(result.merchant_id, mData.email, result.total || result.amount, undefined, result.currency || 'HTG');
      }
    } catch(e) { console.error("Mark as paid notify failed", e); }

    revalidatePath('/system-core/withdrawals');
  }

  return (
    <AdminWithdrawalsClient
      withdrawals={withdrawals || []}
      approveAction={approveManualWithdrawal}
      rejectAction={rejectManualWithdrawal}
      markAsPaidAction={markAsPaid}
    />
  );
}
