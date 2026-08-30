import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { sendBulkEmail } from '@/lib/server/mail';

type NotificationResult = {
  recipients: number;
  sent: number;
  failed: number;
  errors: string[];
};

export async function notifyVerifiedMerchantsOfMaintenance(
  enabled: boolean,
  transitionId: string,
): Promise<NotificationResult> {
  const admin = createAdminClient();
  const merchants: Array<{ id: string; email: string | null }> = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from('merchants')
      .select('id, email')
      .eq('kyc_status', 'approved')
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) {
      return { recipients: 0, sent: 0, failed: 0, errors: [error.message] };
    }
    merchants.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  const verifiedMerchants = merchants.filter(
    (merchant): merchant is { id: string; email: string } =>
      typeof merchant.email === 'string' && merchant.email.includes('@'),
  );

  if (verifiedMerchants.length === 0) {
    return { recipients: 0, sent: 0, failed: 0, errors: [] };
  }

  const subject = enabled
    ? 'Kobara - Maintenance en cours'
    : 'Kobara - Services rétablis';
  const message = enabled
    ? [
        'Bonjour,',
        'Les services Kobara ont été temporairement suspendus afin de réaliser une maintenance planifiée.',
        'Pendant cette intervention, les paiements, retraits, connexions aux services marchands et nouvelles inscriptions sont indisponibles. Vos soldes et vos données restent protégés.',
        'Nous vous informerons dès le rétablissement complet de la plateforme.',
      ].join('\n\n')
    : [
        'Bonjour,',
        'La maintenance est terminée et les services Kobara sont de nouveau disponibles.',
        'Vous pouvez à présent accéder à votre tableau de bord et reprendre normalement vos paiements, retraits et opérations marchandes.',
        'Merci pour votre patience.',
      ].join('\n\n');

  const notificationRows = verifiedMerchants.map((merchant) => ({
    merchant_id: merchant.id,
    type: enabled ? 'system_maintenance_started' : 'system_maintenance_ended',
    title: subject.replace('Kobara - ', ''),
    message,
    resource_id: transitionId,
  }));

  for (let offset = 0; offset < notificationRows.length; offset += 500) {
    const { error: notificationError } = await admin
      .from('notifications')
      .insert(notificationRows.slice(offset, offset + 500));
    if (notificationError) {
      console.error('[MAINTENANCE] Internal notifications failed:', notificationError.message);
    }
  }

  const result = await sendBulkEmail({
    recipients: verifiedMerchants.map((merchant) => merchant.email),
    subject,
    text: message,
    idempotencyKey: `maintenance-${enabled ? 'started' : 'ended'}-${transitionId}`,
  });

  return {
    recipients: verifiedMerchants.length,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
  };
}
