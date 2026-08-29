'use server'

import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { canCreateWithdrawal } from "@/lib/server/access";
import { WithdrawalService } from "@/lib/server/withdrawals/withdrawal.service";
import speakeasy from 'speakeasy';
import { headers } from 'next/headers';

import { WithdrawalOtpService } from "@/lib/server/security/withdrawal-otp";
import { normalizeSixDigitCode } from '@/lib/two-factor';
import { getClientIp, withdrawalsLimiter } from '@/lib/server/security/rate-limit';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { PayPalService } from '@/lib/server/payments/paypal';

export async function sendWithdrawalOtpAction(amount?: number, method?: string) {
  const { user, merchant, userRole } = await getCurrentUserAndMerchant();

  if (!merchant || !user?.email) {
    return { error: "Utilisateur ou marchand non authentifié." };
  }
  if (userRole !== 'owner') {
    return { error: "Accès refusé. Seul le propriétaire peut confirmer un retrait." };
  }

  try {
    const res = await WithdrawalOtpService.sendWithdrawalOtp({
      merchantId: merchant.id,
      userEmail: user.email,
      amount,
      method,
    });
    if (!res.success && res.error) {
      return { error: res.error };
    }
    return { success: true };
  } catch (error: any) {
    console.error("[WithdrawalOtp] Failed to send OTP:", error);
    return { error: error.message || "Impossible d'envoyer le code de vérification." };
  }
}

export async function requestWithdrawal(
  amount: number,
  method: string,
  receiver?: string,
  code2fa?: string,
  sourceCurrency: 'HTG' | 'USD' = 'HTG',
  saveNumber?: boolean
) {
  const { user, merchant, userRole, supabase } = await getCurrentUserAndMerchant();

  if (!merchant) {
    return { error: "Merchant not found" };
  }

  if (userRole !== 'owner') {
    return { error: "Accès refusé. Seul le propriétaire peut effectuer des retraits." };
  }

  const normalizedMethod = String(method || '').trim().toLowerCase();
  const normalizedSourceCurrency = sourceCurrency === 'USD' ? 'USD' : 'HTG';
  if (normalizedSourceCurrency === 'USD' || normalizedMethod === 'zelle' || normalizedMethod === 'paypal') {
    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    if (!usdAccount.isActive) {
      return { error: 'Le compte USD est indisponible ou suspendu. Contactez le support Kobara.', code: 'USD_ACCOUNT_INACTIVE' };
    }
  }
  const providerConfig = normalizedSourceCurrency === 'USD' ? await getPaymentProviderConfig() : null;
  const limitAmountHtg = normalizedSourceCurrency === 'USD'
    ? Number(amount) * Number(providerConfig?.paypal_htg_per_usd || 130)
    : Number(amount);

  const accessCheck = await canCreateWithdrawal(merchant.id, limitAmountHtg);
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'kyc_required') return { error: "Vous devez vérifier votre compte (KYC) pour effectuer des retraits réels." };
    if (accessCheck.reason === 'plan_required') return { error: "Vous devez avoir un plan actif pour retirer des fonds." };
    if (accessCheck.reason === 'subscription_expired') return { error: "Votre abonnement a expiré. Renouvelez-le pour retrouver votre limite Premium.", code: 'SUBSCRIPTION_EXPIRED' };
    if (accessCheck.reason === 'withdrawal_limit_reached') return { error: "Votre limite de retrait journalière est atteinte." };
    return { error: "Accès refusé aux retraits." };
  }

  const isTest = merchant.current_environment === 'test';

  // 2FA Verification (Uniquement en mode Live)
  if (!isTest) {
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('security_json')
      .eq('merchant_id', merchant.id)
      .maybeSingle();

    if (settingsError || !settings) {
      console.error('[Withdrawal] Security settings unavailable:', settingsError);
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
      const rateLimit = await withdrawalsLimiter.limit(`withdrawal-2fa:${merchant.id}:${ip}`);
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

  // Exécution du retrait via le service unifié (atomique + rollback + idempotence)
  const result = await WithdrawalService.processWithdrawal({
    merchantId: merchant.id,
    merchantEmail: merchant.email,
    amount: Number(amount),
    method,
    sourceCurrency: normalizedSourceCurrency,
    receiver,
    environment: isTest ? 'test' : 'live',
    description: 'Retrait Kobara',
  });

  if (!result.success && !result.requiresManualApproval) {
    revalidatePath('/dashboard/withdrawals');
    return { error: result.error || "Échec du retrait." };
  }

  // Sauvegarde éventuelle du numéro MonCash si demandé
  if (saveNumber && (method.toLowerCase() === 'moncash' || method.toLowerCase() === 'natcash') && receiver) {
    const adminClient = createAdminClient();
    const { data: currentSettings } = await supabase
      .from('settings')
      .select('settings_json')
      .eq('merchant_id', merchant.id)
      .maybeSingle();
      
    const generalSettings = currentSettings?.settings_json || {};
    if (method.toLowerCase() === 'moncash') {
      generalSettings.saved_moncash_number = receiver;
    } else {
      generalSettings.saved_natcash_number = receiver;
    }

    await adminClient
      .from('settings')
      .update({ settings_json: generalSettings })
      .eq('merchant_id', merchant.id);
  }

  revalidatePath('/dashboard/withdrawals');
  return { success: true, status: result.status };
}
