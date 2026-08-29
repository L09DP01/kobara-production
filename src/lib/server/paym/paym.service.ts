import crypto from 'crypto';
import { normalizeHaitianPhoneNumber } from '@/lib/payment-routing';

const PAYM_API_URL = (process.env.PAYM_API_URL || 'https://plopplop.solutionip.app').trim().replace(/\/$/, '');
const PAYM_CLIENT_ID = (process.env.PAYM_CLIENT_ID || '').trim();
const PAYM_CLIENT_SECRET = (process.env.PAYM_CLIENT_SECRET || '').trim();

if (!PAYM_CLIENT_ID || !PAYM_CLIENT_SECRET) {
  console.warn("⚠️ Attention: PAYM_CLIENT_ID ou PAYM_CLIENT_SECRET n'est pas configuré dans les variables d'environnement.");
}

// Cache en mémoire pour le jeton marchand (valide ~1 à 5 minutes)
let cachedAuthToken: string | null = null;
let authTokenExpiresAt: number = 0;

export interface PaymCreatePaymentParams {
  amount: number;
  reference: string;
  paymentMethod: 'moncash' | 'moncash_ussd' | 'natcash' | 'all';
  phoneNumber?: string;
  description?: string;
  environment?: 'test' | 'live';
}

export interface PaymCreatePaymentResponse {
  status: boolean;
  message: string;
  url: string | null;
  transaction_id: string;
}

export interface PaymVerifyPaymentResponse {
  status: boolean;
  message: string;
  montant?: number;
  trans_status: 'no' | 'ok';
  id_transaction?: string;
  date?: string;
  heure?: string;
  method?: string;
}

export interface PaymWithdrawalParams {
  amount: number;
  method: 'moncash' | 'natcash';
  receiver: string; // 509XXXXXXXX
  reference: string;
  description?: string;
  environment?: 'test' | 'live';
}

export interface PaymWithdrawalResponse {
  success: boolean;
  message: string;
  stage: 'AUTH' | 'TOKEN' | 'EXECUTE';
  payoutSubmitted: boolean;
  data?: {
    transaction_id: string;
    api_reference: string;
    amount: number;
    fee: number;
    total: number;
    recipient: string;
    reference: string;
    balance_before: number;
    balance_after: number;
    status: 'success' | 'failed';
  };
  error_code?: string;
}

export const PaymService = {
  /**
   * Étape 1 : Obtenir un jeton d'authentification marchand (marchand_login_jwt)
   */
  async getAuthToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && cachedAuthToken && authTokenExpiresAt > now + 10000) {
      return cachedAuthToken;
    }

    if (!PAYM_CLIENT_ID || !PAYM_CLIENT_SECRET) {
      throw new Error("Identifiants Pay'm manquants (PAYM_CLIENT_ID / PAYM_CLIENT_SECRET).");
    }

    const response = await fetch(`${PAYM_API_URL}/api/auth/marchand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PAYM_CLIENT_ID,
        client_secret: PAYM_CLIENT_SECRET,
      }),
    });

    if (!response.ok) {
      cachedAuthToken = null;
      authTokenExpiresAt = 0;
      const errorText = await response.text().catch(() => '');
      console.error("Pay'm Auth HTTP Error:", response.status, errorText);
      throw new Error(`Échec d'authentification Pay'm (${response.status})`);
    }

    const data = await response.json().catch(() => ({}));
    const rawToken =
      (typeof data.token === 'string' && data.token.trim()) ||
      (typeof data.marchand_token === 'string' && data.marchand_token.trim()) ||
      (typeof data.access_token === 'string' && data.access_token.trim()) ||
      (typeof data.jwt === 'string' && data.jwt.trim()) ||
      (data.data && typeof data.data.token === 'string' && data.data.token.trim()) ||
      (data.data && typeof data.data.marchand_token === 'string' && data.data.marchand_token.trim()) ||
      null;

    if (!rawToken || rawToken.length < 10) {
      cachedAuthToken = null;
      authTokenExpiresAt = 0;
      console.error("Pay'm Auth Payload sans token valide:", data);
      throw new Error(data.message || "Impossible d'obtenir le jeton d'authentification marchand Pay'm.");
    }

    cachedAuthToken = rawToken;
    const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 60;
    // Expiration prudente : max 50s pour toujours rafraîchir avant expiration
    authTokenExpiresAt = now + Math.min(expiresInSec, 50) * 1000;

    return rawToken;
  },

  /**
   * Créer un paiement via l'API Pay'm
   * Supports MonCash Web/USSD et NatCash Web
   */
  async createPayment(params: PaymCreatePaymentParams): Promise<PaymCreatePaymentResponse> {
    if (params.environment === 'test') {
      console.log(`[PAYM MOCK] Test payment initialized for reference ${params.reference}`);
      const isUssd = params.paymentMethod.includes('ussd');
      return {
        status: true,
        message: "success",
        url: isUssd ? null : `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/mock-payment?reference=${params.reference}&amount=${params.amount}`,
        transaction_id: `mock_paym_${Date.now()}`
      };
    }

    if (!PAYM_CLIENT_ID) {
      throw new Error("PAYM_CLIENT_ID n'est pas configuré.");
    }

    const formattedPhone = normalizeHaitianPhoneNumber(params.phoneNumber);
    // Pay'm interdit strictement les tirets '-' et underscores '_' (max 20 caractères)
    const safeReference = (params.reference || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);

    const payload: Record<string, any> = {
      client_id: PAYM_CLIENT_ID,
      refference_id: safeReference,
      montant: Number(params.amount),
      payment_method: params.paymentMethod,
    };

    if (params.paymentMethod === 'moncash_ussd' && formattedPhone) {
      payload.phone_number = formattedPhone;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    try {
      const response = await fetch(`${PAYM_API_URL}/api/paiement-marchand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Pay'm Create Payment Error:", response.status, errorData);
        throw new Error(errorData.message || `Échec de l'initialisation du paiement Pay'm (${response.status})`);
      }

      const data = await response.json();
      return {
        status: data.status === true,
        message: data.message || '',
        url: data.url || null,
        transaction_id: data.transaction_id || '',
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error("Délai d'attente dépassé lors de l'appel à Pay'm.");
      }
      throw err;
    }
  },

  /**
   * Vérifier l'état d'un paiement existant
   */
  async verifyPayment(reference: string): Promise<PaymVerifyPaymentResponse> {
    if (reference.startsWith('mock_') || reference.startsWith('TEST-') || reference.startsWith('TEST')) {
      return {
        status: true,
        message: 'Mock verification success',
        trans_status: 'ok',
        id_transaction: `mock_tx_${Date.now()}`,
        montant: 100,
        date: new Date().toISOString().split('T')[0],
        heure: '12:00:00',
        method: 'moncash'
      };
    }

    if (!PAYM_CLIENT_ID) {
      throw new Error("PAYM_CLIENT_ID n'est pas configuré.");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const safeReference = (reference || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);

    try {
      const response = await fetch(`${PAYM_API_URL}/api/paiement-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: PAYM_CLIENT_ID,
          refference_id: safeReference,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Pay'm Verify Payment Error:", response.status, errorData);
        return {
          status: false,
          message: errorData.message || "Erreur de vérification Pay'm",
          trans_status: 'no'
        };
      }

      const data = await response.json();
      return {
        status: data.status === true,
        message: data.message || '',
        montant: data.montant,
        trans_status: data.trans_status === 'ok' ? 'ok' : 'no',
        id_transaction: data.id_transaction,
        date: data.date,
        heure: data.heure,
        method: data.method,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn("Pay'm verify request failed:", err.message);
      return {
        status: false,
        message: err.message,
        trans_status: 'no'
      };
    }
  },

  /**
   * Exécuter un retrait sécurisé en 3 étapes (MonCash ou NatCash)
   * 1. Auth -> 2. Withdrawal Token (HMAC-SHA256) -> 3. Exécution
   */
  async createWithdrawal(params: PaymWithdrawalParams): Promise<PaymWithdrawalResponse> {
    if (params.environment === 'test') {
      console.log(`[PAYM MOCK] Test withdrawal executed for ${params.reference}`);
      return {
        success: true,
        stage: 'EXECUTE',
        payoutSubmitted: true,
        message: "Retrait test simulé avec succès",
        data: {
          transaction_id: `mock_wd_${Date.now()}`,
          api_reference: `${Date.now()}`.slice(-10),
          amount: params.amount,
          fee: 0,
          total: params.amount,
          recipient: params.receiver,
          reference: params.reference,
          balance_before: 10000,
          balance_after: 10000 - params.amount,
          status: 'success'
        }
      };
    }

    if (!PAYM_CLIENT_SECRET) {
      return {
        success: false,
        stage: 'AUTH',
        payoutSubmitted: false,
        message: "Configuration serveur incomplète: PAYM_CLIENT_SECRET manquant.",
        error_code: "NO_CLIENT_SECRET"
      };
    }

    // Normalisation du téléphone à 509XXXXXXXX
    let formattedPhone = params.receiver.replace(/[^0-9]/g, '');
    if (!formattedPhone.startsWith('509') && formattedPhone.length === 8) {
      formattedPhone = `509${formattedPhone}`;
    }

    // Référence purement alphanumérique (aucun '-' ni '_', max 20)
    const safeReference = (params.reference || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);

    // --- Étape 1 : Obtenir AUTH_TOKEN ---
    let authToken: string;
    try {
      authToken = await this.getAuthToken();
    } catch (authError: any) {
      return {
        success: false,
        stage: 'AUTH',
        payoutSubmitted: false,
        message: authError.message || "Échec d'authentification marchand auprès de l'opérateur.",
        error_code: "AUTH_FAILED"
      };
    }

    // --- Étape 2 : Générer le WITHDRAWAL_TOKEN avec signature HMAC-SHA256 ---
    const timestamp = Math.floor(Date.now() / 1000);
    const method = params.method.toLowerCase() as 'moncash' | 'natcash';
    const amountNum = Number(params.amount);
    
    // Formule exacte : "amount|method|recipient|reference|timestamp"
    const payloadToSign = `${amountNum}|${method}|${formattedPhone}|${safeReference}|${timestamp}`;
    const withdrawalSignature = crypto
      .createHmac('sha256', PAYM_CLIENT_SECRET)
      .update(payloadToSign)
      .digest('hex');

    const tokenPayload = {
      token: authToken,
      marchand_token: authToken,
      auth_token: authToken,
      amount: amountNum,
      method: method,
      recipient: formattedPhone,
      reference: safeReference,
      timestamp: timestamp,
      withdrawal_signature: withdrawalSignature,
    };

    const tokenHeaders = {
      'Authorization': `Bearer ${authToken}`,
      'token': authToken,
      'marchand_token': authToken,
      'x-auth-token': authToken,
      'Content-Type': 'application/json',
    };

    let tokenResponse = await fetch(`${PAYM_API_URL}/api/auth/marchand/withdrawal-token?token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: tokenHeaders,
      body: JSON.stringify(tokenPayload),
    });

    // Si le token en cache est refusé (401), invalider et réessayer une fois
    if (tokenResponse.status === 401) {
      try {
        authToken = await this.getAuthToken(true);
        tokenPayload.token = authToken;
        tokenPayload.marchand_token = authToken;
        tokenPayload.auth_token = authToken;
        tokenHeaders['Authorization'] = `Bearer ${authToken}`;
        tokenHeaders['token'] = authToken;
        tokenHeaders['marchand_token'] = authToken;
        tokenHeaders['x-auth-token'] = authToken;

        tokenResponse = await fetch(`${PAYM_API_URL}/api/auth/marchand/withdrawal-token?token=${encodeURIComponent(authToken)}`, {
          method: 'POST',
          headers: tokenHeaders,
          body: JSON.stringify(tokenPayload),
        });
      } catch (retryAuthError) {
        return {
          success: false,
          stage: 'TOKEN',
          payoutSubmitted: false,
          message: "Jeton d'authentification invalide et impossible à rafraîchir.",
          error_code: "AUTH_EXPIRED"
        };
      }
    }

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      console.error("Pay'm Withdrawal Token Error:", tokenResponse.status, errorData);
      return {
        success: false,
        stage: 'TOKEN',
        payoutSubmitted: false,
        message: errorData.message || `Échec de préparation du retrait (${tokenResponse.status})`,
        error_code: errorData.error_code || "TOKEN_GENERATION_FAILED"
      };
    }

    const tokenData = await tokenResponse.json().catch(() => ({}));
    const withdrawalToken = tokenData.withdrawal_token || tokenData.token;

    if (!withdrawalToken) {
      return {
        success: false,
        stage: 'TOKEN',
        payoutSubmitted: false,
        message: "Jeton de retrait non retourné par le fournisseur.",
        error_code: "MISSING_WITHDRAWAL_TOKEN"
      };
    }

    // --- Étape 3 : Exécuter le retrait ---
    // À partir d'ici, la requête de transfert est soumise
    try {
      const executeResponse = await fetch(`${PAYM_API_URL}/api/withdraw/marchand?token=${encodeURIComponent(withdrawalToken)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${withdrawalToken}`,
          'token': withdrawalToken,
          'withdrawal_token': withdrawalToken,
          'x-auth-token': withdrawalToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: withdrawalToken,
          withdrawal_token: withdrawalToken,
          amount: amountNum,
          method: method,
          recipient: formattedPhone,
          reference: safeReference,
        }),
      });

      const executeData = await executeResponse.json().catch(() => ({}));

      if (!executeResponse.ok || !executeData.success) {
        console.error("Pay'm Withdraw Exec Error:", executeResponse.status, executeData);
        const errorMsg = executeData.message || `Échec du retrait (${executeResponse.status})`;
        return {
          success: false,
          stage: 'EXECUTE',
          payoutSubmitted: true,
          message: errorMsg,
          error_code: executeData.error_code || 'API_TRANSFER_FAILED',
          data: executeData.data,
        };
      }

      return {
        success: true,
        stage: 'EXECUTE',
        payoutSubmitted: true,
        message: executeData.message || "Retrait effectué avec succès",
        data: executeData.data,
      };
    } catch (networkError: any) {
      // Erreur réseau ou timeout STRICTEMENT à l'étape 3
      console.error(`[PaymService] Exception réseau lors de l'exécution du retrait ${safeReference}:`, networkError.message);
      throw networkError; // Rejette pour que WithdrawalService tente une vérification
    }
  },

  /**
   * Vérifier le statut d'un retrait existant
   */
  async verifyWithdrawal(reference: string) {
    if (reference.startsWith('mock_') || reference.startsWith('TEST-') || reference.startsWith('TEST')) {
      return {
        success: true,
        data: { status: 'success', reference }
      };
    }

    let authToken = await this.getAuthToken();
    const safeReference = (reference || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);

    let response = await fetch(`${PAYM_API_URL}/api/withdraw/marchand/verify?token=${encodeURIComponent(authToken)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'token': authToken,
        'x-auth-token': authToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: authToken,
        marchand_token: authToken,
        reference: safeReference,
      }),
    });

    if (response.status === 401) {
      authToken = await this.getAuthToken(true);
      response = await fetch(`${PAYM_API_URL}/api/withdraw/marchand/verify?token=${encodeURIComponent(authToken)}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'token': authToken,
          'x-auth-token': authToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: authToken,
          marchand_token: authToken,
          reference: safeReference,
        }),
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        status: response.status,
        message: errorData.message || "Erreur lors de la vérification du retrait",
      };
    }

    return await response.json();
  }
};
