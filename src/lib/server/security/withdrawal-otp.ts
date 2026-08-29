import 'server-only';

import crypto from 'node:crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { sendEmail } from '@/lib/server/mail';
import { normalizeSixDigitCode } from '@/lib/two-factor';

function getHmacSecret() {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('La configuration de sécurité OTP du serveur est incomplète.');
  }
  return secret;
}

type WithdrawalOtpRpcResult = {
  status?: 'issued' | 'verified' | 'invalid' | 'expired' | 'locked' | 'cooldown' | 'no_code' | 'settings_missing';
  remaining_attempts?: number;
  remaining_seconds?: number;
};

function getRpcResult(data: unknown): WithdrawalOtpRpcResult {
  if (Array.isArray(data)) return (data[0] || {}) as WithdrawalOtpRpcResult;
  return (data || {}) as WithdrawalOtpRpcResult;
}

/**
 * Service OTP dédié aux retraits.
 * 
 * Séparé du LoginSecurityService (connexion) pour éviter toute confusion :
 * - Le code envoyé est clairement identifié comme "Code de vérification de retrait"
 * - Stocké dans settings.security_json (email_otp_code / email_otp_expires_at)
 * - Ne touche PAS aux trusted_login_contexts ni login_security_challenges
 */
export class WithdrawalOtpService {
  /**
   * Génère un OTP de retrait, le stocke hashé dans settings.security_json,
   * et envoie un email au marchand avec le sujet "retrait".
   */
  static async sendWithdrawalOtp(params: {
    merchantId: string;
    userEmail: string;
    amount?: number;
    method?: string;
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    // 1. Générer un code à 6 chiffres
    const rawOtp = crypto.randomInt(100000, 999999).toString();

    // 2. Hash HMAC-SHA256 du code (ne jamais stocker en clair)
    const otpHash = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`withdrawal_otp:${params.merchantId}:${rawOtp}`, 'utf8')
      .digest('hex');

    const sentAt = new Date();
    const expiresAt = new Date(sentAt.getTime() + 10 * 60 * 1000);

    // 3. Stocker atomiquement le hash avant d'envoyer l'e-mail. La RPC crée
    // aussi la ligne settings lorsqu'un ancien marchand n'en possède pas.
    const { data: issueData, error: issueError } = await supabase.rpc('issue_withdrawal_otp', {
      p_merchant_id: params.merchantId,
      p_otp_hash: otpHash,
      p_expires_at: expiresAt.toISOString(),
      p_sent_at: sentAt.toISOString(),
    });

    if (issueError) {
      console.error('[WithdrawalOtp] Failed to persist OTP:', issueError);
      return { success: false, error: "Impossible d'enregistrer le code de retrait. Veuillez réessayer." };
    }

    const issueResult = getRpcResult(issueData);
    if (issueResult.status === 'locked') {
      const remainingMinutes = Math.ceil(Number(issueResult.remaining_seconds || 300) / 60);
      return {
        success: false,
        error: `Compte temporairement verrouillé pour les retraits. Veuillez patienter ${remainingMinutes} minute(s).`,
      };
    }
    if (issueResult.status === 'cooldown') {
      return {
        success: false,
        error: `Un code vous a déjà été envoyé. Veuillez patienter ${Number(issueResult.remaining_seconds || 30)} seconde(s) avant de demander un renvoi.`,
      };
    }
    if (issueResult.status !== 'issued') {
      return { success: false, error: "Impossible d'initialiser le code de retrait. Veuillez réessayer." };
    }

    // 4. Construire le détail du retrait pour l'email
    const amountText = params.amount
      ? `${params.amount.toLocaleString('fr-HT')} HTG`
      : 'Montant non spécifié';
    const methodText = params.method || 'Non spécifié';

    // 5. Envoyer l'email avec le bon sujet
    const emailSubject = 'Code de vérification de retrait — Kobara';
    const emailBody = `
Bonjour,

Une demande de retrait a été initiée sur votre compte Kobara :
- Montant : ${amountText}
- Méthode : ${methodText}

Pour confirmer cette opération, veuillez saisir le code de vérification à 6 chiffres suivant :

${rawOtp}

Ce code est confidentiel et expire dans 10 minutes.
Si vous n'êtes pas à l'origine de cette demande, veuillez immédiatement sécuriser votre compte et contacter notre équipe de support.

L'équipe de sécurité Kobara
    `.trim();

    try {
      await sendEmail({
        to: params.userEmail,
        subject: emailSubject,
        text: emailBody,
        html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #ea580c; margin-top: 0;">Vérification de retrait</h2>
          <p>Une demande de retrait a été initiée sur votre compte Kobara :</p>
          <div style="background: #f9fafb; padding: 12px; border-radius: 6px; font-size: 13px; color: #4b5563; margin-bottom: 20px;">
            <strong>Montant :</strong> ${amountText}<br/>
            <strong>Méthode :</strong> ${methodText}
          </div>
          <p>Voici votre code de confirmation temporaire :</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827; background: #f3f4f6; padding: 12px 24px; border-radius: 8px; font-family: monospace;">
              ${rawOtp}
            </span>
          </div>
          <p style="font-size: 12px; color: #6b7280;">Ce code expire dans 10 minutes (maximum 5 tentatives). Ne le partagez avec personne.</p>
        </div>
      `,
      });
    } catch (emailError) {
      await supabase.rpc('revoke_withdrawal_otp', {
        p_merchant_id: params.merchantId,
        p_otp_hash: otpHash,
      });
      throw emailError;
    }

    return { success: true };
  }

  /**
   * Vérifie le code OTP de retrait soumis par l'utilisateur.
   * Compare via HMAC-SHA256 + timing-safe equal et applique la limitation des essais (Max 5).
   */
  static async verifyWithdrawalOtp(params: {
    merchantId: string;
    code: string;
  }): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();
    // Assainissement strict : ne garder que les chiffres (retire espaces, tirets, caractères invisibles)
    const cleanCode = normalizeSixDigitCode(params.code);

    if (!cleanCode) {
      return { success: false, error: 'Le code doit comporter exactement 6 chiffres.' };
    }

    // Calculer le hash attendu sans transmettre le code brut à PostgreSQL.
    const expectedHash = crypto
      .createHmac('sha256', getHmacSecret())
      .update(`withdrawal_otp:${params.merchantId}:${cleanCode}`, 'utf8')
      .digest('hex');

    // La RPC verrouille la ligne, vérifie et consomme le code dans une seule
    // transaction. Deux requêtes concurrentes ne peuvent donc pas le réutiliser.
    const { data: consumeData, error: consumeError } = await supabase.rpc('consume_withdrawal_otp', {
      p_merchant_id: params.merchantId,
      p_otp_hash: expectedHash,
      p_now: new Date().toISOString(),
    });

    if (consumeError) {
      console.error('[WithdrawalOtp] Failed to consume OTP:', consumeError);
      return { success: false, error: 'Impossible de vérifier le code de retrait. Veuillez réessayer.' };
    }

    const result = getRpcResult(consumeData);
    if (result.status === 'verified') return { success: true };
    if (result.status === 'expired') {
      return { success: false, error: 'Le code de vérification a expiré (validité 10 minutes). Veuillez en demander un nouveau.' };
    }
    if (result.status === 'locked') {
      const remainingMinutes = Math.ceil(Number(result.remaining_seconds || 300) / 60);
      return {
        success: false,
        error: `Trop de tentatives erronées. Ce code a été révoqué. Veuillez patienter ${remainingMinutes} minute(s).`,
      };
    }
    if (result.status === 'invalid') {
      const remainingAttempts = Number(result.remaining_attempts || 0);
      return {
        success: false,
        error: `Code de vérification incorrect. (${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''} restante${remainingAttempts > 1 ? 's' : ''})`,
      };
    }

    return { success: false, error: "Aucun code actif. Veuillez demander un nouveau code de confirmation." };
  }
}
