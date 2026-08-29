import { normalizeHaitianPhoneNumber } from '@/lib/payment-routing';
import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from '@/lib/server/payments/gateway';
import { PaymService } from '@/lib/server/paym/paym.service';
import { BazikService } from '@/lib/server/bazik/bazik.service';
import { notifyWithdrawalCreated, notifyAdminWithdrawalCreated, notifyWithdrawalSuccess, notifyWithdrawalFailed } from '@/lib/server/notifications';
import { calculateWithdrawalQuote } from '@/lib/withdrawal-currency';
import { PayPalService } from '@/lib/server/payments/paypal';

export interface ProcessWithdrawalParams {
  merchantId: string;
  merchantEmail?: string;
  amount: number;
  method: string; // 'MonCash' | 'NatCash' | 'Zelle'
  sourceCurrency?: 'HTG' | 'USD';
  receiver?: string;
  idempotencyKey?: string;
  environment?: 'test' | 'live';
  description?: string;
}

export interface ProcessWithdrawalResult {
  success: boolean;
  status?: 'completed' | 'pending' | 'failed' | 'pending_approval';
  withdrawal?: any;
  error?: string;
  errorCode?: string;
  refunded?: boolean;
  requiresManualApproval?: boolean;
  requiresVerification?: boolean;
}

export const WithdrawalService = {
  /**
   * Valide et exécute un retrait de façon atomique et sécurisée
   */
  async processWithdrawal(params: ProcessWithdrawalParams): Promise<ProcessWithdrawalResult> {
    const {
      merchantId,
      merchantEmail,
      amount,
      method,
      sourceCurrency = 'HTG',
      receiver,
      idempotencyKey,
      environment = 'test',
      description = 'Retrait Kobara',
    } = params;

    const normalizedMethod = (method || '').trim().toLowerCase();
    const normalizedSourceCurrency = sourceCurrency === 'USD' ? 'USD' : 'HTG';

    // 1. Validation de la méthode
    if (!['moncash', 'natcash', 'zelle', 'paypal'].includes(normalizedMethod)) {
      return { success: false, error: 'Méthode de retrait non supportée.' };
    }

    // 2. Validation des montants
    if (isNaN(amount) || amount <= 0) {
      return { success: false, error: 'Le montant de retrait doit être supérieur à zéro.' };
    }

    // 3. Validation et normalisation stricte du destinataire
    let normalizedReceiver = (receiver || '').trim();

    if (normalizedMethod === 'moncash' || normalizedMethod === 'natcash') {
      if (!normalizedReceiver) {
        return { success: false, error: `Numéro de réception requis pour ${method}.` };
      }

      const validPhone = normalizeHaitianPhoneNumber(normalizedReceiver);
      if (!validPhone) {
        return {
          success: false,
          error: 'Numéro de téléphone haïtien invalide. Format attendu : 8 chiffres (ex: 34567890) ou avec indicatif 509 (ex: 50934567890).',
        };
      }
      normalizedReceiver = validPhone;
    } else if (normalizedMethod === 'zelle') {
      if (!normalizedReceiver) {
        return { success: false, error: 'Identifiant Zelle (email ou téléphone) requis.' };
      }
    } else if (normalizedMethod === 'paypal') {
      if (!normalizedReceiver) {
        return { success: false, error: 'Adresse email ou identifiant PayPal requis.' };
      }
    }

    // 4. Le compte source est choisi par le marchand. Le moyen de réception
    // détermine la devise envoyée, avec conversion au taux administratif.
    const isUsdOrManual = normalizedMethod === 'zelle' || normalizedMethod === 'paypal';

    if (normalizedSourceCurrency === 'USD' || isUsdOrManual) {
      const adminClient = createAdminClient();
      const { data: merchant } = await adminClient
        .from('merchants')
        .select('id, paypal_enabled, has_usd_account')
        .eq('id', merchantId)
        .maybeSingle();
      const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
      if (!usdAccount.isActive) {
        return {
          success: false,
          error: 'Le compte USD est indisponible ou suspendu. Contactez le support Kobara.',
          errorCode: 'USD_ACCOUNT_INACTIVE',
        };
      }
    }

    // 5. Génération d'une référence unique Pay'm purement alphanumérique (aucun tiret '-' ni underscore '_', max 20 caractères)
    const { createPaymReference } = await import('@/lib/payment-routing');
    const kobaraReference = createPaymReference('WTH');

    // Déterminer le provider et figer le taux utilisé dans le retrait.
    const config = await getPaymentProviderConfig();
    const exchangeRate = Number(config.paypal_htg_per_usd || 130);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      return { success: false, error: 'Le taux de conversion HTG/USD est indisponible.' };
    }

    const quote = calculateWithdrawalQuote({
      amount,
      method: normalizedMethod,
      sourceCurrency: normalizedSourceCurrency,
      exchangeRate,
    });
    const { payoutCurrency, fees, netSourceAmount: netAmount, grossAmount: total, payoutAmount } = quote;

    if (payoutCurrency === 'USD' && payoutAmount < 10) {
      return { success: false, error: `Le montant net à recevoir doit être d'au moins 10 USD.` };
    }
    if (payoutCurrency === 'HTG' && payoutAmount < 150) {
      return { success: false, error: 'Le montant net à recevoir doit être d’au moins 150 HTG.' };
    }

    const adminClient = createAdminClient();

    // 6. TRANSACTION ATOMIQUE A : Réservation du solde et création du retrait 'pending'
    let { data: prepResult, error: prepError } = await adminClient.rpc('prepare_automatic_withdrawal', {
      p_merchant_id: merchantId,
      p_amount: netAmount,
      p_fees: fees,
      p_total: total,
      p_method: normalizedMethod,
      p_provider: normalizedMethod, // Stocke la méthode lisible ('natcash', 'moncash', 'zelle', 'paypal')
      p_wallet: normalizedReceiver,
      p_reference: kobaraReference,
      p_environment: environment,
      p_source_currency: normalizedSourceCurrency,
      p_payout_currency: payoutCurrency,
      p_exchange_rate: exchangeRate,
      p_payout_amount: payoutAmount,
      p_idempotency_key: idempotencyKey || null,
      p_description: description,
    });

    // Compatibilité transitoire si l’application est déployée quelques minutes
    // avant la migration. Les conversions croisées restent bloquées plutôt que
    // de débiter le mauvais compte.
    if (prepError && (prepError.code === 'PGRST202' || prepError.message?.includes('Could not find the function'))) {
      if (normalizedSourceCurrency !== payoutCurrency) {
        return { success: false, error: 'La conversion de devise est en cours d’activation. Veuillez réessayer dans quelques minutes.' };
      }
      const legacy = await adminClient.rpc('prepare_automatic_withdrawal', {
        p_merchant_id: merchantId,
        p_amount: netAmount,
        p_fees: fees,
        p_total: total,
        p_method: normalizedMethod,
        p_provider: normalizedMethod,
        p_wallet: normalizedReceiver,
        p_reference: kobaraReference,
        p_environment: environment,
        p_idempotency_key: idempotencyKey || null,
        p_description: description,
      });
      prepResult = legacy.data;
      prepError = legacy.error;
    }

    if (prepError) {
      console.error('[WithdrawalService] RPC prepare_automatic_withdrawal error:', prepError);
      return { success: false, error: 'Erreur technique lors de la réservation des fonds.' };
    }

    if (!prepResult || !prepResult.success) {
      return {
        success: false,
        error: prepResult?.message || prepResult?.error || 'Solde insuffisant ou données invalides.',
        errorCode: prepResult?.error,
      };
    }

    // Idempotence : si le retrait existait déjà pour cette clé
    if (prepResult.already_exists) {
      console.log(`[WithdrawalService] Idempotent request detected for key ${idempotencyKey}`);
      return {
        success: true,
        status: prepResult.withdrawal?.status,
        withdrawal: prepResult.withdrawal,
      };
    }

    const withdrawal = prepResult.withdrawal;
    const withdrawalId = withdrawal.id;

    // 7. Retrait manuel (Zelle ou PayPal ou NatCash sous Bazik)
    if (isUsdOrManual) {
      try {
        if (merchantEmail) {
          await notifyWithdrawalCreated(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
        }
        await notifyAdminWithdrawalCreated(merchantId, payoutAmount, method, undefined, normalizedReceiver, undefined, payoutCurrency, total, normalizedSourceCurrency);
      } catch (e) {
        console.error('[WithdrawalService] Notification error:', e);
      }

      return {
        success: true,
        status: 'pending_approval',
        requiresManualApproval: true,
        withdrawal,
      };
    }

    // --- MODE TEST / SANDBOX AUTONOME ---
    // En mode test, le retrait est immédiatement validé et le solde de test est débité sans appel externe
    if (environment === 'test') {
      const testTxId = `TEST_WTH_${Date.now().toString(36).toUpperCase()}`;
      await adminClient.rpc('complete_automatic_withdrawal', {
        p_withdrawal_id: withdrawalId,
        p_provider_transaction_id: testTxId,
        p_provider_response: { success: true, mode: 'test_sandbox', transaction_id: testTxId },
      });

      try {
        if (merchantEmail) {
          await notifyWithdrawalSuccess(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
        }
        await notifyAdminWithdrawalCreated(merchantId, payoutAmount, method, undefined, normalizedReceiver, undefined, payoutCurrency, total, normalizedSourceCurrency);
      } catch (e) {
        console.error('[WithdrawalService] Notification error:', e);
      }

      return {
        success: true,
        status: 'completed',
        withdrawal: { ...withdrawal, status: 'completed', bazik_transaction_id: testTxId },
      };
    }

    // 8. Retrait automatisé en mode Live : Pay'm ou Bazik
    if (config.active_provider === 'paym') {
      const paymMethod = normalizedMethod === 'moncash' ? 'moncash' : 'natcash';

      try {
        const paymResponse = await PaymService.createWithdrawal({
          amount: payoutAmount,
          method: paymMethod,
          receiver: normalizedReceiver,
          reference: kobaraReference,
          description: description,
          environment: environment,
        });

        // Cas A : Succès confirmé
        if (paymResponse.success && paymResponse.data?.status !== 'failed') {
          const providerTxId = paymResponse.data?.transaction_id || paymResponse.data?.api_reference || null;

          await adminClient.rpc('complete_automatic_withdrawal', {
            p_withdrawal_id: withdrawalId,
            p_provider_transaction_id: providerTxId,
            p_provider_response: paymResponse,
          });

          try {
            if (merchantEmail) {
              await notifyWithdrawalSuccess(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
            }
            await notifyAdminWithdrawalCreated(merchantId, payoutAmount, method, undefined, normalizedReceiver, undefined, payoutCurrency, total, normalizedSourceCurrency);
          } catch (e) {
            console.error('[WithdrawalService] Notification error:', e);
          }

          return {
            success: true,
            status: 'completed',
            withdrawal: { ...withdrawal, status: 'completed', bazik_transaction_id: providerTxId },
          };
        }

        // Cas B : Échec pré-payout (Auth / Token) ou échec confirmé par l'opérateur
        const rawErrorMsg = paymResponse.message || "Le retrait n'a pas pu être exécuté par l'opérateur.";
        console.warn(`[WithdrawalService] Échec retrait pour ${kobaraReference} (stage: ${paymResponse.stage}, submitted: ${paymResponse.payoutSubmitted}):`, rawErrorMsg);

        // Remboursement atomique immédiat
        await adminClient.rpc('fail_and_refund_withdrawal', {
          p_withdrawal_id: withdrawalId,
          p_reason: rawErrorMsg,
          p_provider_response: paymResponse,
        });

        try {
          if (merchantEmail) {
            await notifyWithdrawalFailed(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
          }
        } catch (e) {
          console.error('[WithdrawalService] Notification error:', e);
        }

        let userFacingError = rawErrorMsg;
        if (userFacingError.toLowerCase().includes("jeton") || userFacingError.toLowerCase().includes("token") || userFacingError.toLowerCase().includes("auth")) {
          userFacingError = "Le service de retrait est temporairement indisponible auprès de l'opérateur. Votre solde a été immédiatement recrédité.";
        }

        return {
          success: false,
          status: 'failed',
          refunded: true,
          error: userFacingError,
          errorCode: paymResponse.error_code || 'PROVIDER_TRANSFER_FAILED',
        };
      } catch (networkError: any) {
        // Cas C : Résultat externe incertain uniquement survenu lors du payout effectif
        console.error(`[WithdrawalService] Incertitude réseau lors de l'exécution pour ${kobaraReference}:`, networkError.message);

        try {
          // Tenter une vérification de statut
          const verifyResult = await PaymService.verifyWithdrawal(kobaraReference);
          const verifyStatus = verifyResult?.data?.status || (verifyResult?.status ? 'success' : 'unknown');

          if (verifyStatus === 'success' || verifyStatus === 'completed') {
            const providerTxId = verifyResult?.data?.transaction_id || verifyResult?.data?.api_reference || null;

            await adminClient.rpc('complete_automatic_withdrawal', {
              p_withdrawal_id: withdrawalId,
              p_provider_transaction_id: providerTxId,
              p_provider_response: verifyResult,
            });

            if (merchantEmail) {
              await notifyWithdrawalSuccess(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
            }

            return {
              success: true,
              status: 'completed',
              withdrawal: { ...withdrawal, status: 'completed', bazik_transaction_id: providerTxId },
            };
          } else if (verifyStatus === 'failed' || verifyStatus === 'cancelled' || verifyStatus === 'rejected' || verifyResult?.status === 404) {
            await adminClient.rpc('fail_and_refund_withdrawal', {
              p_withdrawal_id: withdrawalId,
              p_reason: 'Échec confirmé lors de la vérification de l\'opérateur',
              p_provider_response: verifyResult,
            });

            if (merchantEmail) {
              await notifyWithdrawalFailed(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
            }

            return {
              success: false,
              status: 'failed',
              refunded: true,
              error: 'Le retrait n\'a pas pu être exécuté. Vos fonds ont été retournés sur votre solde.',
            };
          }
        } catch (verifyError: any) {
          console.warn(`[WithdrawalService] Échec de la vérification après timeout pour ${kobaraReference}:`, verifyError.message);
        }

        // Notification d'attente seulement si le statut reste réellement indéterminé
        try {
          if (merchantEmail) {
            await notifyWithdrawalCreated(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
          }
        } catch (e) {}

        return {
          success: false,
          status: 'pending',
          requiresVerification: true,
          error: "Le statut du transfert est en cours de confirmation par l'opérateur. Votre compte sera mis à jour dès confirmation.",
        };
      }
    }

    // Cas Legacy Bazik
    if (config.active_provider === 'bazik') {
      if (normalizedMethod === 'moncash') {
        try {
          const bazikResponse = await BazikService.createWithdrawal({
            amount: payoutAmount,
            receiver: normalizedReceiver,
            reference: kobaraReference,
            description: description,
            environment: environment,
          });

          const bazikStatus = bazikResponse?.status?.toLowerCase();
          const isCompleted = bazikStatus === 'success' || bazikStatus === 'successful' || bazikStatus === 'completed';

          if (isCompleted) {
            const providerTxId = bazikResponse?.transaction_id || bazikResponse?.id || null;
            await adminClient.rpc('complete_automatic_withdrawal', {
              p_withdrawal_id: withdrawalId,
              p_provider_transaction_id: providerTxId,
              p_provider_response: bazikResponse,
            });

            if (merchantEmail) {
              await notifyWithdrawalSuccess(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
            }

            return {
              success: true,
              status: 'completed',
              withdrawal: { ...withdrawal, status: 'completed', bazik_transaction_id: providerTxId },
            };
          } else {
            // En attente webhook
            return {
              success: true,
              status: 'pending',
              withdrawal,
            };
          }
        } catch (bazikError: any) {
          console.error(`[WithdrawalService] Bazik error for ${kobaraReference}:`, bazikError.message);
          await adminClient.rpc('fail_and_refund_withdrawal', {
            p_withdrawal_id: withdrawalId,
            p_reason: bazikError.message || 'Échec du transfert Bazik',
          });

          if (merchantEmail) {
            await notifyWithdrawalFailed(merchantId, merchantEmail, total, undefined, normalizedSourceCurrency);
          }

          return {
            success: false,
            status: 'failed',
            refunded: true,
            error: bazikError.message || 'Échec du transfert Bazik',
          };
        }
      } else {
        // NatCash sous Bazik : approbation manuelle
        return {
          success: true,
          status: 'pending_approval',
          requiresManualApproval: true,
          withdrawal,
        };
      }
    }

    return {
      success: true,
      status: 'pending',
      withdrawal,
    };
  },
};
