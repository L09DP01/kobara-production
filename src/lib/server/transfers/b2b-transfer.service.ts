import 'server-only';

import { canCreateWithdrawal } from '@/lib/server/access';
import { createAdminClient } from '@/utils/supabase/admin';

type B2BTransferRpcResult = {
  success?: boolean;
  error?: string;
  code?: string;
  transfer_id?: string;
  withdrawal_id?: string;
  payment_id?: string;
  receiver_id?: string;
  receiver_email?: string;
  receiver_business_name?: string;
  reference?: string;
  sender_balance_after?: number | string;
  receiver_balance_after?: number | string;
  withdrawable_balance?: number | string;
};

export type B2BTransferResult = {
  success: boolean;
  error?: string;
  code?: string;
  transferId?: string;
  withdrawalId?: string;
  paymentId?: string;
  reference?: string;
  receiverId?: string;
  receiverEmail?: string;
  receiverBusinessName?: string;
  senderBalanceAfter?: number;
  receiverBalanceAfter?: number;
  withdrawableBalance?: number;
};

function normalizeAmount(amount: number) {
  if (!Number.isFinite(amount)) return null;
  const normalized = Math.round(amount * 100) / 100;
  if (normalized < 1 || Math.abs(normalized - amount) > Number.EPSILON) return null;
  return normalized;
}

function normalizeEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

export class B2BTransferService {
  static async processTransfer(params: {
    senderId: string;
    receiverEmail: string;
    amount: number;
    environment?: 'live' | 'test';
    source?: 'dashboard' | 'telegram' | 'mobile';
  }): Promise<B2BTransferResult> {
    const amount = normalizeAmount(params.amount);
    const receiverEmail = normalizeEmail(params.receiverEmail);
    const environment = params.environment === 'test' ? 'test' : 'live';

    if (!amount) {
      return { success: false, error: 'Le montant minimum est de 1 HTG et deux décimales maximum sont autorisées.', code: 'INVALID_AMOUNT' };
    }
    if (!receiverEmail) {
      return { success: false, error: "L'adresse e-mail du destinataire est invalide.", code: 'INVALID_RECEIVER_EMAIL' };
    }

    if (environment === 'live') {
      const access = await canCreateWithdrawal(params.senderId, amount);
      if (!access.allowed) {
        const messages = {
          subscription_expired: 'Votre abonnement a expiré.',
          withdrawal_limit_reached: 'Votre limite journalière est atteinte.',
          kyc_required: 'Votre compte doit être vérifié pour effectuer ce transfert.',
          plan_required: 'Un plan actif est requis pour effectuer ce transfert.',
          payment_limit_reached: 'Accès refusé.',
          api_key_limit_reached: 'Accès refusé.',
        } as const;
        return { success: false, error: messages[access.reason], code: access.reason.toUpperCase() };
      }
    }

    const admin = createAdminClient();
    const { data: result, error: rpcError } = await admin.rpc('process_b2b_transfer_v3', {
      p_sender_id: params.senderId,
      p_receiver_email: receiverEmail,
      p_amount: amount,
      p_environment: environment,
    });

    if (rpcError) {
      console.error('[B2BTransferService] Atomic transfer failed:', rpcError);
      return { success: false, error: "Le transfert n'a pas pu être comptabilisé. Aucun débit ne doit être considéré comme définitif.", code: 'TRANSFER_FAILED' };
    }

    const rpc = (result || {}) as B2BTransferRpcResult;
    if (!rpc.success) {
      return {
        success: false,
        error: rpc.error || 'Le transfert a échoué.',
        code: rpc.code,
        withdrawableBalance: Number(rpc.withdrawable_balance || 0),
      };
    }

    if (!rpc.transfer_id
      || !rpc.withdrawal_id
      || !rpc.payment_id
      || !rpc.receiver_id
      || rpc.sender_balance_after === undefined
      || rpc.receiver_balance_after === undefined) {
      console.error('[B2BTransferService] RPC returned an incomplete accounting result:', rpc);
      return { success: false, error: "Le transfert a été enregistré mais sa confirmation comptable est incomplète. Contactez le support avec la référence affichée.", code: 'INCOMPLETE_ACCOUNTING_RESULT', reference: rpc.reference };
    }

    const response: B2BTransferResult = {
      success: true,
      transferId: rpc.transfer_id,
      withdrawalId: rpc.withdrawal_id,
      paymentId: rpc.payment_id,
      reference: rpc.reference,
      receiverId: rpc.receiver_id,
      receiverEmail: rpc.receiver_email || receiverEmail,
      receiverBusinessName: rpc.receiver_business_name,
      senderBalanceAfter: Number(rpc.sender_balance_after || 0),
      receiverBalanceAfter: Number(rpc.receiver_balance_after || 0),
    };

    if (environment === 'live') {
      try {
        const { data: sender } = await admin
          .from('merchants')
          .select('email, business_name')
          .eq('id', params.senderId)
          .single();
        const { data: receiver } = await admin
          .from('merchants')
          .select('email')
          .eq('id', rpc.receiver_id)
          .single();

        const {
          notifyAdminWithdrawalCreated,
          notifyB2BTransferReceived,
          notifyB2BTransferSent,
        } = await import('@/lib/server/notifications');

        if (sender?.email) {
          await notifyB2BTransferSent(params.senderId, sender.email, amount, response.receiverEmail || receiverEmail);
        }
        if (receiver?.email) {
          await notifyB2BTransferReceived(rpc.receiver_id, receiver.email, amount, sender?.business_name || 'Un marchand');
        }
        await notifyAdminWithdrawalCreated(params.senderId, amount, 'B2B Transfer', undefined, response.receiverEmail || receiverEmail, amount);

        const { TelegramNotifierService } = await import('@/lib/server/telegram/telegram-notifier.service');
        await TelegramNotifierService.notifyB2BTransferReceived({
          receiverId: rpc.receiver_id,
          senderBusinessName: sender?.business_name || 'Un marchand',
          amount,
          reference: rpc.reference || rpc.transfer_id,
        });
      } catch (notificationError) {
        console.error('[B2BTransferService] Transfer notifications failed:', notificationError);
      }
    }

    return response;
  }
}
