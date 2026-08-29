import { createAdminClient } from '@/utils/supabase/admin';
import { onPaymentSucceeded } from '@/lib/server/payments/on-payment-succeeded';

export interface SimulatePaymentInput {
  paymentId?: string | null;
  reference?: string | null;
  merchantId?: string | null;
  targetStatus?: 'succeeded' | 'failed';
}

export interface SimulatePaymentResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  payment?: any;
}

/**
 * Exécute la simulation d'un paiement de test dans Kobara :
 * 1. Vérifie l'existence du paiement et son appartenance à l'environnement 'test'.
 * 2. Met à jour le statut dans la table Supabase `payments` ('succeeded' ou 'failed').
 * 3. Le trigger Postgres `handle_payment_success` crédite automatiquement `available_balance_test`.
 * 4. Déclenche `onPaymentSucceeded` pour envoyer les webhooks signés (`payment.succeeded`) et notifications au marchand.
 */
export async function handleSimulateTestPayment(input: SimulatePaymentInput): Promise<SimulatePaymentResult> {
  const supabase = createAdminClient();
  const { paymentId, reference, merchantId, targetStatus = 'succeeded' } = input;

  if (!paymentId && !reference) {
    return {
      success: false,
      error: "Veuillez fournir 'payment_id' ou 'reference' pour identifier le paiement de test.",
      statusCode: 400,
    };
  }

  // 1. Recherche du paiement
  let query = supabase.from('payments').select('*');

  if (paymentId) {
    query = query.eq('id', paymentId);
  } else if (reference) {
    query = query.or(`kobara_reference.eq.${reference},reference_code.eq.${reference},bazik_order_id.eq.${reference}`);
  }

  if (merchantId) {
    query = query.eq('merchant_id', merchantId);
  }

  const { data: payment, error: searchError } = await query.maybeSingle();

  if (searchError || !payment) {
    return {
      success: false,
      error: `Paiement introuvable (${paymentId || reference || 'référence inconnue'}).`,
      statusCode: 404,
    };
  }

  // 2. Vérification stricte de l'environnement de TEST
  if (payment.environment !== 'test') {
    return {
      success: false,
      error: "La simulation est strictement réservée aux paiements créés en mode TEST.",
      statusCode: 403,
    };
  }

  // Si le paiement est déjà complété
  if (payment.status === 'succeeded' && targetStatus === 'succeeded') {
    return {
      success: true,
      payment,
    };
  }

  const nowIso = new Date().toISOString();

  // 3. Mise à jour transactionnelle dans la base de données
  if (targetStatus === 'succeeded') {
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        paid_at: nowIso,
        payment_method: payment.payment_method || 'moncash_test',
        metadata: {
          ...(payment.metadata || {}),
          simulated_at: nowIso,
          simulated_via: 'test_api_simulation',
        },
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError || !updatedPayment) {
      console.error("Erreur de mise à jour du paiement de test:", updateError);
      return {
        success: false,
        error: "Erreur lors de l'enregistrement du paiement dans la base de données.",
        statusCode: 500,
      };
    }

    // 4. Déclencher le handler centralisé (webhooks, notifications, plans)
    try {
      await onPaymentSucceeded(updatedPayment.id);
    } catch (err) {
      console.error("Erreur lors de l'envoi des webhooks de test:", err);
    }

    return {
      success: true,
      payment: updatedPayment,
    };
  } else {
    // Echec simulé
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          ...(payment.metadata || {}),
          simulated_failed_at: nowIso,
          simulated_via: 'test_api_simulation',
        },
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (updateError || !updatedPayment) {
      return {
        success: false,
        error: "Erreur lors de l'enregistrement de l'échec du paiement.",
        statusCode: 500,
      };
    }

    try {
      const { dispatchMerchantWebhook } = await import('@/lib/server/webhooks/dispatcher');
      await dispatchMerchantWebhook({
        merchantId: updatedPayment.merchant_id,
        environment: 'test',
        eventType: 'payment.failed',
        data: {
          id: updatedPayment.id,
          reference: updatedPayment.kobara_reference,
          amount: updatedPayment.amount,
          net_amount: updatedPayment.net_amount,
          fee_amount: updatedPayment.fee_amount,
          currency: updatedPayment.currency,
          status: 'failed',
          provider: updatedPayment.provider,
          payment_method: updatedPayment.payment_method,
          metadata: updatedPayment.metadata,
          reason: 'test_simulation',
        },
      });
    } catch (webhookError) {
      console.error('Erreur lors de l’envoi du webhook d’échec de test:', webhookError);
    }

    return {
      success: true,
      payment: updatedPayment,
    };
  }
}
