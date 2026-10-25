import 'server-only';
import { createAdminClient } from '@/utils/supabase/admin';
import type { EmailPresentation } from './template';

export async function getWithdrawalReceiptPresentation(merchantId: string, withdrawalId?: string): Promise<EmailPresentation | undefined> {
  if (!withdrawalId) return undefined;
  const db = createAdminClient();
  const { data: withdrawal, error } = await db.from('withdrawals').select('*')
    .eq('id', withdrawalId).eq('merchant_id', merchantId).maybeSingle();
  if (error) throw error;
  if (!withdrawal) return undefined;
  const statuses = { pending: 'pending', pending_approval: 'pending', processing: 'pending', approved: 'approved', completed: 'succeeded', failed: 'failed', rejected: 'rejected', cancelled: 'cancelled' } as const;
  const status = statuses[withdrawal.status as keyof typeof statuses];
  if (!status) return undefined;
  const { data: merchant, error: merchantError } = await db.from('merchants').select('business_name')
    .eq('id', merchantId).maybeSingle();
  if (merchantError) throw merchantError;
  const methodId = String(withdrawal.method || withdrawal.provider || '').toLowerCase();
  const methods: Record<string, string> = { moncash: 'MonCash', natcash: 'NatCash', zelle: 'Zelle', paypal: 'PayPal', crypto: 'Crypto' };
  const method = methods[methodId] || undefined;
  const timestamp = status === 'succeeded' ? withdrawal.completed_at : status === 'pending' ? withdrawal.created_at : withdrawal.updated_at;
  const date = timestamp && Number.isFinite(Date.parse(timestamp))
    ? new Date(timestamp).toLocaleString('fr-FR', { timeZone: 'America/Port-au-Prince', dateStyle: 'long', timeStyle: 'short' }) : undefined;
  const amount = Number(withdrawal.amount);
  return {
    type: 'transaction', operation: 'withdrawal', status,
    ...(withdrawal.amount != null && Number.isFinite(amount) && amount >= 0 ? { amount } : {}),
    currency: withdrawal.currency || undefined,
    reference: withdrawal.kobara_reference || withdrawal.id, date, method,
    merchantName: merchant?.business_name || undefined,
    description: withdrawal.description || (method ? `Retrait vers ${method}` : undefined),
    notice: status === 'succeeded' ? 'Votre retrait a bien été exécuté. Conservez cette référence pour vos dossiers.' : undefined,
    action: { url: 'https://dashboard.kobara.app/withdrawals', label: 'Voir le retrait' },
  };
}
