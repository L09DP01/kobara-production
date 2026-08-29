import { createAdminClient } from '@/utils/supabase/admin';
import { BazikService } from '@/lib/server/bazik/bazik.service';
import { PaymService } from '@/lib/server/paym/paym.service';
import { PaymentProviderConfig, DEFAULT_PROVIDER_CONFIG } from '@/types/payment-provider';
import {
  normalizePaymentRoutingConfig,
  isValidPaymReference,
  PaymentRoute,
  PaymentRoutingError,
  resolvePaymentRoute,
} from '@/lib/payment-routing';

export type { PaymentProviderConfig };
export { DEFAULT_PROVIDER_CONFIG };

let cachedConfig: PaymentProviderConfig | null = null;
let configCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds cache

/**
 * Récupère la configuration globale des fournisseurs de paiement
 */
export async function getPaymentProviderConfig(): Promise<PaymentProviderConfig> {
  const now = Date.now();
  if (cachedConfig && now - configCacheTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'payment_provider_config')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_PROVIDER_CONFIG;
    }

    cachedConfig = normalizePaymentRoutingConfig({
      ...DEFAULT_PROVIDER_CONFIG,
      ...(data.value as Partial<PaymentProviderConfig>),
    });
    configCacheTime = now;
    return cachedConfig;
  } catch (err) {
    console.error("Erreur lors de la lecture de system_settings:", err);
    return DEFAULT_PROVIDER_CONFIG;
  }
}

/**
 * Met à jour la configuration globale des fournisseurs de paiement
 */
export async function updatePaymentProviderConfig(
  updates: Partial<PaymentProviderConfig>,
  updatedBy?: string
): Promise<PaymentProviderConfig> {
  const current = await getPaymentProviderConfig();
  const updated: PaymentProviderConfig = {
    ...current,
    ...updates,
  };

  // Pay'm owns both wallets. The SMS gateway can only accept new payments in Bazik mode.
  if (updated.active_provider === 'paym') {
    updated.sms_gateway_enabled = false;
  } else if (updates.active_provider === 'bazik' && updates.sms_gateway_enabled === undefined) {
    updated.sms_gateway_enabled = true;
  }

  updated.paym_natcash_ussd = false;
  const normalizedUpdated = normalizePaymentRoutingConfig(updated);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key: 'payment_provider_config',
      value: normalizedUpdated,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || 'system',
    });

  if (error) {
    console.error("Erreur mise à jour system_settings:", error);
    throw new Error(`Impossible de mettre à jour la configuration: ${error.message}`);
  }

  // Invalider le cache
  cachedConfig = normalizedUpdated;
  configCacheTime = Date.now();

  return normalizedUpdated;
}

/**
 * Vérifie si le SMS Gateway NatCash est actif
 */
export async function isSmsGatewayActive(): Promise<boolean> {
  const config = await getPaymentProviderConfig();
  return config.active_provider === 'bazik' && config.sms_gateway_enabled === true;
}

export interface CreatePaymentGatewayParams {
  amount: number;
  reference: string;
  provider: 'moncash' | 'natcash' | 'carte' | 'card' | 'paypal';
  paymentMethodType?: 'web' | 'ussd';
  phoneNumber?: string;
  description?: string;
  environment?: 'test' | 'live';
  successUrl?: string;
  cancelUrl?: string;
  errorUrl?: string;
}

export interface CreatePaymentGatewayResult {
  isUssd: boolean;
  paymentUrl: string | null;
  orderId: string | null;
  transactionId: string | null;
  provider: 'bazik' | 'paym' | 'sms_gateway' | 'paypal';
  processor: 'bazik' | 'paym' | 'sms_gateway' | 'paypal';
  paymentMethod: 'moncash' | 'moncash_ussd' | 'natcash' | 'paypal' | 'carte';
  route: PaymentRoute;
  status: string;
}

/**
 * Initialise un paiement via le fournisseur actif
 */
export async function createPaymentGateway(
  params: CreatePaymentGatewayParams
): Promise<CreatePaymentGatewayResult> {
  const isCardOrPayPal = params.provider === 'carte' || params.provider === 'card' || params.provider === 'paypal';

  if (isCardOrPayPal) {
    throw new PaymentRoutingError(
      'CHECKOUT_REQUIRED',
      'Les paiements internationaux doivent être initialisés depuis le checkout Kobara.',
    );
  }

  const config = await getPaymentProviderConfig();
  const route = resolvePaymentRoute(config, {
    wallet: params.provider as 'moncash' | 'natcash',
    requestedMethod: params.paymentMethodType,
    phoneNumber: params.phoneNumber,
  });

  // --- MODE TEST / SANDBOX AUTONOME ---
  // En mode test, aucun appel réseau n'est effectué vers Pay'm ou Bazik.
  if (params.environment === 'test') {
    const sandboxTxId = `TEST_TX_${Date.now().toString(36).toUpperCase()}`;
    return {
      isUssd: false,
      paymentUrl: null,
      orderId: sandboxTxId,
      transactionId: sandboxTxId,
      provider: config.active_provider === 'paym' ? 'paym' : 'bazik',
      processor: config.active_provider === 'paym' ? 'paym' : 'bazik',
      paymentMethod: route.providerMethod,
      route,
      status: 'pending',
    };
  }

  if (route.processor === 'paym') {
    if (!Number.isFinite(params.amount) || params.amount < 20) {
      throw new PaymentRoutingError(
        'PAYM_MINIMUM_AMOUNT',
        "Le montant minimum de ce paiement est de 20 HTG."
      );
    }

    if (!isValidPaymReference(params.reference)) {
      throw new PaymentRoutingError(
        'PAYM_INVALID_REFERENCE',
        "La référence doit contenir uniquement 1 à 20 lettres ou chiffres."
      );
    }

    let paymResponse;
    try {
      paymResponse = await PaymService.createPayment({
        amount: params.amount,
        reference: params.reference,
        paymentMethod: route.providerMethod,
        phoneNumber: params.phoneNumber,
        description: params.description,
        environment: params.environment,
      });
    } catch (createError) {
      const verification = await PaymService.verifyPayment(params.reference);
      const rawErrorMessage = createError instanceof Error ? createError.message : String(createError);
      console.error(JSON.stringify({
        level: 'error',
        event: 'paym_create_reconciliation',
        reference: params.reference,
        payment_method: route.providerMethod,
        create_error: rawErrorMessage,
        verify_status: verification.status,
        transaction_status: verification.trans_status,
        transaction_id: verification.id_transaction || null,
        verified_amount: verification.montant ?? null,
        verified_method: verification.method || null,
      }));
      throw new PaymentRoutingError(
        'PAYMENT_PROVIDER_UNAVAILABLE',
        rawErrorMessage || 'Le fournisseur de paiement est temporairement indisponible. Veuillez réessayer.'
      );
    }

    if (!paymResponse.status || !paymResponse.transaction_id) {
      throw new Error('Le fournisseur de paiement n’a pas créé la transaction.');
    }

    if (route.requiresRedirect && !paymResponse.url) {
      throw new Error("Le fournisseur n'a pas retourné l'URL de paiement attendue.");
    }

    return {
      isUssd: route.methodType === 'ussd',
      paymentUrl: paymResponse.url || null,
      orderId: paymResponse.transaction_id || null,
      transactionId: paymResponse.transaction_id || null,
      provider: 'paym',
      processor: 'paym',
      paymentMethod: route.providerMethod,
      route,
      status: 'pending',
    };
  }

  if (route.processor === 'bazik') {
    let bazikResponse;
    try {
      bazikResponse = await BazikService.createMoncashPayment({
        amount: params.amount,
        reference: params.reference,
        description: params.description,
        environment: params.environment,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
        errorUrl: params.errorUrl,
      });
    } catch (error) {
      console.error(JSON.stringify({
        event: 'legacy_provider_payment_creation_failed',
        message: error instanceof Error ? error.message : String(error),
      }));
      throw new PaymentRoutingError(
        'PAYMENT_PROVIDER_UNAVAILABLE',
        'Le fournisseur de paiement est temporairement indisponible. Veuillez réessayer.'
      );
    }

    const bazikOrderId = bazikResponse.order_id || bazikResponse.id || null;
    const bazikData = bazikResponse.data || bazikResponse;
    const paymentUrl = bazikData.paymentUrl || bazikData.payment_url || bazikData.checkout_url || bazikData.checkoutUrl || bazikData.redirectUrl || bazikData.redirect_url || bazikData.url || null;

    return {
      isUssd: false,
      paymentUrl,
      orderId: bazikOrderId,
      transactionId: bazikOrderId,
      provider: 'bazik',
      processor: 'bazik',
      paymentMethod: route.providerMethod,
      route,
      status: 'pending',
    };
  }

  // NatCash under Bazik is confirmed asynchronously by the Android SMS gateway.
  return {
    isUssd: false,
    paymentUrl: null,
    orderId: null,
    transactionId: null,
    provider: 'sms_gateway',
    processor: 'sms_gateway',
    paymentMethod: route.providerMethod,
    route,
    status: 'pending',
  };
}

export interface WithdrawalGatewayParams {
  amount: number;
  method: string; // 'MonCash', 'NatCash', 'Zelle'
  receiver: string;
  reference: string;
  description?: string;
  environment?: 'test' | 'live';
}

export interface WithdrawalGatewayResult {
  success: boolean;
  status: 'completed' | 'pending' | 'failed' | 'pending_approval';
  transactionId: string | null;
  requiresManualApproval: boolean;
  message?: string;
  balanceBefore?: number;
  balanceAfter?: number;
}

/**
 * Exécute un retrait via le fournisseur actif
 */
export async function createWithdrawalGateway(
  params: WithdrawalGatewayParams
): Promise<WithdrawalGatewayResult> {
  const config = await getPaymentProviderConfig();
  const normalizedMethod = params.method.toLowerCase();

  // Zelle : toujours manuel
  if (normalizedMethod === 'zelle') {
    return {
      success: true,
      status: 'pending_approval',
      transactionId: null,
      requiresManualApproval: true,
      message: "Retrait Zelle en attente d'approbation manuelle",
    };
  }

  if (config.active_provider === 'paym') {
    // Pay'm gère MonCash ET NatCash 100% automatiquement
    const paymMethod = (normalizedMethod === 'moncash' ? 'moncash' : 'natcash') as 'moncash' | 'natcash';

    const paymResponse = await PaymService.createWithdrawal({
      amount: params.amount,
      method: paymMethod,
      receiver: params.receiver,
      reference: params.reference,
      description: params.description,
      environment: params.environment,
    });

    if (!paymResponse.success) {
      return {
        success: false,
        status: 'failed',
        transactionId: null,
        requiresManualApproval: false,
        message: paymResponse.message || "Échec du transfert Pay'm",
      };
    }

    return {
      success: true,
      status: 'completed',
      transactionId: paymResponse.data?.transaction_id || paymResponse.data?.api_reference || null,
      requiresManualApproval: false,
      balanceBefore: paymResponse.data?.balance_before,
      balanceAfter: paymResponse.data?.balance_after,
    };
  }

  // Bazik : MonCash est automatique, NatCash requiert approbation manuelle
  if (normalizedMethod === 'moncash') {
    try {
      const bazikResponse = await BazikService.createWithdrawal({
        amount: params.amount,
        receiver: params.receiver,
        reference: params.reference,
        description: params.description,
        environment: params.environment,
      });

      const bazikStatus = bazikResponse?.status?.toLowerCase();
      const isCompleted = bazikStatus === 'success' || bazikStatus === 'successful' || bazikStatus === 'completed';

      return {
        success: true,
        status: isCompleted ? 'completed' : 'pending',
        transactionId: bazikResponse?.transaction_id || bazikResponse?.id || null,
        requiresManualApproval: false,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        transactionId: null,
        requiresManualApproval: false,
        message: error.message || "Échec du transfert Bazik",
      };
    }
  }

  // NatCash sous Bazik : en attente d'approbation manuelle
  return {
    success: true,
    status: 'pending_approval',
    transactionId: null,
    requiresManualApproval: true,
    message: "Retrait NatCash en attente d'approbation admin",
  };
}
