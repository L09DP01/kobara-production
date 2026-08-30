'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import speakeasy from 'speakeasy';
import { canCreateWithdrawal } from '@/lib/server/access';
import { headers } from 'next/headers';
import { normalizeSixDigitCode } from '@/lib/two-factor';
import { getClientIp, withdrawalsLimiter } from '@/lib/server/security/rate-limit';
import { WithdrawalOtpService } from '@/lib/server/security/withdrawal-otp';

export async function executeB2BTransfer(amount: number, receiverEmail: string, code2fa?: string) {
  const { user, merchant, userRole, supabase } = await getCurrentUserAndMerchant();

  if (!merchant) {
    return { error: "Merchant not found" };
  }

  if (userRole !== 'owner') {
    return { error: "Accès refusé. Seul le propriétaire peut effectuer des transferts B2B." };
  }

  const accessCheck = await canCreateWithdrawal(merchant.id, amount);
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'subscription_expired') {
      return { error: "Votre abonnement a expiré. Renouvelez-le pour retrouver vos limites Premium.", code: 'SUBSCRIPTION_EXPIRED' };
    }
    if (accessCheck.reason === 'withdrawal_limit_reached') return { error: "Votre limite journalière est atteinte." };
    if (accessCheck.reason === 'kyc_required') return { error: "Votre compte doit être vérifié pour effectuer ce transfert." };
    return { error: 'Accès refusé.' };
  }

  const activeBalance = Number(merchant.available_balance || 0);

  if (amount > activeBalance) {
    return { error: "Solde insuffisant pour ce transfert." };
  }

  if (amount < 1) {
    return { error: "Le montant minimum est de 1 HTG." };
  }

  // 2FA Verification
  {
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('security_json')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error('[B2B Withdrawal] Security settings unavailable:', settingsError);
      return { error: "Impossible de charger les paramètres de sécurité du compte." };
    }
    
    const security = settings?.security_json || {};
    const twoFactorMethod = security.two_factor_method || 'none';

    if (code2fa) {
      const cleanCode = normalizeSixDigitCode(code2fa);
      if (!cleanCode) {
        return { error: "Le code de sécurité doit comporter exactement 6 chiffres." };
      }

      const headersList = await headers();
      const ip = getClientIp(headersList);
      const rateLimit = await withdrawalsLimiter.limit(`b2b-2fa:${merchant.id}:${ip}`);
      if (!rateLimit.success) {
        return { error: "Trop de tentatives. Veuillez patienter avant de réessayer." };
      }

      if (twoFactorMethod === 'totp') {
        if (!security.totp_secret) {
          return { error: "Le Passkey de ce compte n'est pas correctement configuré." };
        }
        const verified = speakeasy.totp.verify({
          secret: security.totp_secret,
          encoding: 'base32',
          token: cleanCode,
          window: 1
        });
        if (!verified) {
          return { error: "Le code de l'application (TOTP) est invalide." };
        }
      } else {
        const otpCheck = await WithdrawalOtpService.verifyWithdrawalOtp({
          merchantId: merchant.id,
          code: cleanCode,
        });

        if (!otpCheck.success) {
          return { error: otpCheck.error || "Le code de vérification est invalide." };
        }
      }
    } else {
      return { 
        error: "Une validation de sécurité (Code) est requise.",
        code: "validation_required",
        twoFactorMethod: twoFactorMethod === 'totp' ? 'totp' : 'email'
      };
    }
  }

  const adminClient = createAdminClient();

  // Validate receiver KYC status
  const { data: receiverData, error: receiverError } = await adminClient
    .from('merchants')
    .select('id, status, kyc_status')
    .eq('email', receiverEmail)
    .single();

  if (receiverError || !receiverData) {
    return { error: "Marchand destinataire introuvable." };
  }

  if (receiverData.status !== 'active' || (receiverData.kyc_status !== 'approved' && receiverData.kyc_status !== 'verified')) {
    return { error: "Le compte de ce marchand n'est pas vérifié ou est inactif. Le transfert ne peut pas être effectué." };
  }

  // Executing the secure RPC function
  const { data: rpcResult, error: rpcError } = await adminClient.rpc('process_b2b_transfer', {
    p_sender_id: merchant.id,
    p_receiver_email: receiverEmail,
    p_amount: amount,
    p_environment: 'live'
  });

  if (rpcError) {
    console.error("B2B Transfer RPC Error:", rpcError);
    return { error: "Erreur lors de l'exécution du transfert. Veuillez réessayer." };
  }

  if (!rpcResult.success) {
    return {
      error: rpcResult.error || "Le transfert a échoué.",
      code: rpcResult.code,
      withdrawableBalance: rpcResult.withdrawable_balance,
    };
  }

  // Notifications
  const { notifyB2BTransferSent, notifyB2BTransferReceived, notifyAdminWithdrawalCreated } = await import('@/lib/server/notifications');
  try {
    const { data: senderData } = await adminClient.from('merchants').select('email, business_name').eq('id', merchant.id).single();
    if (senderData) {
      await notifyB2BTransferSent(merchant.id, senderData.email, amount, receiverEmail);
    }
    
    const { data: receiverData } = await adminClient.from('merchants').select('email').eq('id', rpcResult.receiver_id).single();
    if (receiverData) {
      await notifyB2BTransferReceived(rpcResult.receiver_id, receiverData.email, amount, senderData?.business_name || 'Un marchand');
    }

    // Notifier l'admin pour tous les transferts B2B
    await notifyAdminWithdrawalCreated(merchant.id, amount, 'B2B Transfer', undefined, receiverEmail, amount);
  } catch(e) { 
    console.error("Notifications for B2B failed", e); 
  }

  revalidatePath('/dashboard/withdrawals');
  return { success: true };
}
