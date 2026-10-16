import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { activationReminderEmail, type ActivationReminderKind } from '@/lib/activation-reminder-email';

type Reminder = { merchant_id: string; email: string; business_name: string; kind: ActivationReminderKind; delivery_id: string; lease_token: string };

export async function processActivationReminders() {
  if (process.env.ACTIVATION_REMINDERS_ENABLED === 'false') return { disabled: true, claimed: 0, sent: 0, skipped: 0, failed: 0 };
  if (!process.env.RESEND_API_KEY) throw new Error('activation_reminder_email_not_configured');
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_merchant_activation_reminders');
  if (error) throw new Error('activation_reminder_queue_unavailable');
  const reminders = (data || []) as Reminder[];
  const result = { claimed: reminders.length, sent: 0, skipped: 0, failed: 0 };
  for (const reminder of reminders) {
    try {
      // Recheck the current payment/KYC state immediately before contacting the email provider.
      const { data: eligible, error: checkError } = await admin.rpc('validate_merchant_activation_reminder', {
        p_merchant_id: reminder.merchant_id, p_lease_token: reminder.lease_token,
      });
      if (checkError) throw new Error('activation_reminder_check_failed');
      if (!eligible) { result.skipped++; continue; }
      const content = activationReminderEmail(reminder.kind, reminder.business_name);
      const delivery = await sendEmail({ to: reminder.email, ...content, replyTo: 'support@kobara.app', idempotencyKey: `activation-reminder-${reminder.delivery_id}` });
      const { data: saved, error: saveError } = await admin.rpc('finish_merchant_activation_reminder', {
        p_merchant_id: reminder.merchant_id, p_lease_token: reminder.lease_token, p_sent: delivery.success,
      });
      if (saveError || !saved) throw new Error('activation_reminder_delivery_state_uncertain');
      if (delivery.success) result.sent++;
      else result.failed++;
    } catch {
      result.failed++;
      console.error('[ActivationReminders] Delivery requires retry or review.', { merchantId: reminder.merchant_id, deliveryId: reminder.delivery_id });
    }
  }
  return result;
}
