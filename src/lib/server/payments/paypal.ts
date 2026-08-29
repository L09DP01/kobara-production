import 'server-only';

import { createAdminClient } from '@/utils/supabase/admin';
import { getPaymentProviderConfig } from './gateway';
import { resolveUsdAccountState, type UsdAccountState } from '@/lib/usd-account';
/* eslint-disable @typescript-eslint/no-explicit-any -- PayPal REST responses vary by funding source and have no local generated types. */

export const HTG_TO_USD_RATE = 130;
export const PAYPAL_FEE_PERCENT = 3.5;
export const PAYPAL_FEE_FIXED_USD = 0.70;
export const USD_WITHDRAWAL_FEE_PERCENT = 0.02; // 2%

export interface PayPalFeeCalculation {
  grossUsd: number;
  feeUsd: number;
  netUsd: number;
}

export interface UsdWithdrawalFeeCalculation {
  amountUsd: number;
  feeUsd: number;
  netUsd: number;
}

export interface PayPalCreateOrderParams {
  amountUsd: number;
  reference: string;
  paymentId: string;
  paymentMethod?: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  description?: string;
  payerName?: string;
  payerEmail?: string;
  returnUrl?: string;
  cancelUrl?: string;
  environment?: 'test' | 'live';
}

export interface PayPalOrderResult {
  orderId: string;
  checkoutUrl: string;
}

export interface PayPalCaptureResult {
  success: boolean;
  captureId?: string;
  amountUsd?: number;
  currency?: string;
  payerEmail?: string;
  processorFeeUsd?: number;
  paymentSource?: 'card' | 'paypal' | 'apple_pay' | 'google_pay';
  raw?: Record<string, unknown>;
  error?: string;
}

export class PayPalService {
  /**
   * Convertit un montant en Gourdes (HTG) en Dollars US (USD) selon le taux 130 = 1 USD.
   */
  static convertHtgToUsd(amountHtg: number, htgPerUsd = HTG_TO_USD_RATE): number {
    if (!amountHtg || amountHtg <= 0) return 0;
    if (!Number.isFinite(htgPerUsd) || htgPerUsd <= 0) {
      throw new Error('Le taux HTG/USD est invalide.');
    }
    return Math.max(0.01, parseFloat((amountHtg / htgPerUsd).toFixed(2)));
  }

  /**
   * Calcule les frais Kobara pour un encaissement USD : 3.5% + $0.70
   */
  static calculateFees(
    amountUsd: number,
    feePercent = PAYPAL_FEE_PERCENT,
    fixedFeeUsd = PAYPAL_FEE_FIXED_USD,
  ): PayPalFeeCalculation {
    const gross = Math.max(0, parseFloat(Number(amountUsd).toFixed(2)));
    const fee = Math.min(
      gross,
      parseFloat(((gross * (feePercent / 100)) + fixedFeeUsd).toFixed(2)),
    );
    const net = Math.max(0, parseFloat((gross - fee).toFixed(2)));
    return {
      grossUsd: gross,
      feeUsd: fee,
      netUsd: net,
    };
  }

  /**
   * Calcule les frais de retrait USD (Zelle / PayPal) : 2%
   */
  static calculateWithdrawalFees(amountUsd: number): UsdWithdrawalFeeCalculation {
    const gross = Math.max(0, parseFloat(Number(amountUsd).toFixed(2)));
    const fee = parseFloat((gross * USD_WITHDRAWAL_FEE_PERCENT).toFixed(2));
    const net = Math.max(0, parseFloat((gross - fee).toFixed(2)));
    return {
      amountUsd: gross,
      feeUsd: fee,
      netUsd: net,
    };
  }

  /**
   * Vérifie si un marchand est éligible pour PayPal / Compte USD
   */
  static async getMerchantUsdAccountState(merchant: {
    id: string;
    paypal_enabled?: boolean | null;
    has_usd_account?: boolean | null;
  } | null): Promise<UsdAccountState> {
    if (!merchant) return resolveUsdAccountState({});

    const supabase = createAdminClient();
    const needsMerchantLookup = merchant.paypal_enabled === undefined || merchant.has_usd_account === undefined;
    const [{ data: settings }, storedMerchantResult] = await Promise.all([
      supabase
        .from('settings')
        .select('settings_json')
        .eq('merchant_id', merchant.id)
        .maybeSingle(),
      needsMerchantLookup
        ? supabase
            .from('merchants')
            .select('paypal_enabled, has_usd_account')
            .eq('id', merchant.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const storedMerchant = storedMerchantResult.data;

    const globalConfig = await getPaymentProviderConfig();
    return resolveUsdAccountState({
      merchantEnabled: merchant.paypal_enabled ?? storedMerchant?.paypal_enabled,
      settingsEnabled: settings?.settings_json?.paypal_enabled,
      merchantHasAccount: merchant.has_usd_account ?? storedMerchant?.has_usd_account,
      settingsHasAccount: settings?.settings_json?.has_usd_account,
      globalEnabled: globalConfig.paypal_global_enabled,
    });
  }

  static async isMerchantEligible(merchant: {
    id: string;
    paypal_enabled?: boolean | null;
    has_usd_account?: boolean | null;
  } | null): Promise<boolean> {
    const state = await this.getMerchantUsdAccountState(merchant);
    return state.isEnabled;
  }

  /**
   * Récupère le jeton d'accès OAuth2 PayPal (Live ou Sandbox)
   */
  static async getAccessToken(isLive = true): Promise<string | null> {
    void isLive;
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('[PayPal] Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET');
      return null;
    }

    const baseUrl = this.getApiBaseUrl();

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!res.ok) {
        console.error('[PayPal] Failed to fetch access token:', res.status, await res.text());
        return null;
      }

      const data = await res.json();
      return data.access_token || null;
    } catch (err) {
      console.error('[PayPal] OAuth fetch error:', err);
      return null;
    }
  }

  static getApiBaseUrl(): string {
    const configured = process.env.PAYPAL_API_URL?.trim().replace(/\/$/, '');
    if (!configured || !/^https:\/\/api-m(?:\.sandbox)?\.paypal\.com$/i.test(configured)) {
      throw new Error('PAYPAL_API_URL doit pointer vers une API officielle PayPal.');
    }
    return configured;
  }

  static getWebSdkUrl(): string {
    return this.getApiBaseUrl().includes('.sandbox.')
      ? 'https://www.sandbox.paypal.com/web-sdk/v6/core'
      : 'https://www.paypal.com/web-sdk/v6/core';
  }

  static getPublicClientId(): string {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    if (!clientId) throw new Error('PAYPAL_CLIENT_ID est manquant.');
    return clientId;
  }

  static async getBrowserSafeClientToken(domain: string): Promise<{ token: string; expiresIn: number }> {
    const clientId = this.getPublicClientId();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    if (!clientSecret) throw new Error('PAYPAL_CLIENT_SECRET est manquant.');

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      response_type: 'client_token',
      intent: 'sdk_init',
    });
    body.append('domains[]', domain);

    const response = await fetch(`${this.getApiBaseUrl()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      console.error('[PayPal] Browser-safe token failed:', response.status, payload?.error);
      throw new Error("Impossible d'initialiser le paiement sécurisé.");
    }

    return { token: payload.access_token, expiresIn: Number(payload.expires_in || 900) };
  }

  /**
   * Crée un ordre de paiement PayPal Orders API v2 en USD
   */
  static async createOrder(params: PayPalCreateOrderParams): Promise<PayPalOrderResult> {
    const accessToken = await this.getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';

    const defaultReturn = `${appUrl}/api/payments/paypal/return?payment_id=${encodeURIComponent(params.paymentId)}&reference=${encodeURIComponent(params.reference)}`;
    const defaultCancel = `${appUrl}/pay/checkout/${params.paymentId}?status=cancel`;

    const returnUrl = params.returnUrl || defaultReturn;
    const cancelUrl = params.cancelUrl || defaultCancel;

    if (!accessToken) throw new Error('Identifiants PayPal indisponibles.');
    if (!Number.isFinite(params.amountUsd) || params.amountUsd <= 0) {
      throw new Error('Le montant USD est invalide.');
    }
    const baseUrl = this.getApiBaseUrl();
    const payerName = params.payerName?.trim().split(/\s+/).filter(Boolean) || [];
    const payerEmail = params.payerEmail?.trim().toLowerCase() || '';
    const payer = {
      ...(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail) ? { email_address: payerEmail } : {}),
      ...(payerName.length ? {
        name: {
          given_name: payerName[0].slice(0, 140),
          surname: (payerName.slice(1).join(' ') || payerName[0]).slice(0, 140),
        },
      } : {}),
    };

      const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `KBR${params.paymentId.replace(/-/g, '')}`.slice(0, 38),
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          ...(Object.keys(payer).length ? { payer } : {}),
          purchase_units: [
            {
              reference_id: params.reference,
              custom_id: params.paymentId,
              invoice_id: params.reference,
              description: params.description || `Paiement Kobara ${params.reference}`,
              amount: {
                currency_code: 'USD',
                value: params.amountUsd.toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: 'Kobara',
            locale: 'fr-FR',
            landing_page: 'BILLING', // Ouvre directement le formulaire de carte ou PayPal
            user_action: 'PAY_NOW',
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        }),
      });

      if (res.ok) {
        const order = await res.json();
        const approveLink = order.links?.find((l: any) => l.rel === 'approve' || l.rel === 'payer-action')?.href;
        return {
          orderId: order.id,
          checkoutUrl: approveLink || `${baseUrl}/checkoutnow?token=${order.id}`,
        };
      } else {
        const errorText = await res.text();
        console.error('[PayPal] Orders v2 creation error:', res.status, errorText);
        throw new Error(`PayPal a refusé la création de l'ordre (${res.status}).`);
      }
  }

  /**
   * Capture un ordre PayPal payé via /v2/checkout/orders/{id}/capture
   */
  static async captureOrder(orderId: string, isLive = true): Promise<PayPalCaptureResult> {
    void isLive;
    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      return { success: false, error: 'Identifiants PayPal indisponibles' };
    }

    const baseUrl = this.getApiBaseUrl();

    try {
      const res = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': `KBRCAP${orderId.replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 38),
        },
      });

      const responseText = await res.text();
      let captureData: any = {};
      try {
        captureData = JSON.parse(responseText);
      } catch {
        // Raw text response
      }

      if (res.status === 422) {
        const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        });
        if (orderResponse.ok) captureData = await orderResponse.json();
      } else if (!res.ok) {
        return { success: false, error: responseText };
      }

      // Si déjà capturé (COMPLETED) ou ORDER_ALREADY_CAPTURED
      if (captureData.status === 'COMPLETED') {
        const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];
        const payerEmail = captureData.payer?.email_address;
        const sourceKey = Object.keys(captureData.payment_source || {})[0];
        const normalizedSource = sourceKey === 'apple_pay'
          ? 'apple_pay'
          : sourceKey === 'google_pay'
            ? 'google_pay'
            : sourceKey === 'card'
              ? 'card'
              : 'paypal';
        return {
          success: true,
          captureId: capture?.id,
          amountUsd: capture?.amount?.value ? Number(capture.amount.value) : undefined,
          currency: capture?.amount?.currency_code || 'USD',
          payerEmail,
          processorFeeUsd: capture?.seller_receivable_breakdown?.paypal_fee?.value
            ? Number(capture.seller_receivable_breakdown.paypal_fee.value)
            : undefined,
          paymentSource: normalizedSource,
          raw: captureData,
        };
      }

      return {
        success: false,
        error: captureData.message || responseText || 'Échec de la capture PayPal',
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Vérifie l'authenticité de la signature d'un Webhook PayPal
   * Référence : https://developer.paypal.com/api/rest/webhooks/rest/#verify-webhook-signature
   */
  static async verifyWebhookSignature(params: {
    authAlgo: string;
    certUrl: string;
    transmissionId: string;
    transmissionSig: string;
    transmissionTime: string;
    webhookEvent: any;
    isLive?: boolean;
  }): Promise<boolean> {
    void params.isLive;
    const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();

    // En environnement de test / sandbox sans webhook ID explicite
    if (!webhookId) {
      console.error('[PayPal Webhook] PAYPAL_WEBHOOK_ID is not configured.');
      return false;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      console.error('[PayPal Webhook] Cannot verify signature without access token');
      return false;
    }

    const baseUrl = this.getApiBaseUrl();

    try {
      const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          auth_algo: params.authAlgo,
          cert_url: params.certUrl,
          transmission_id: params.transmissionId,
          transmission_sig: params.transmissionSig,
          transmission_time: params.transmissionTime,
          webhook_id: webhookId,
          webhook_event: params.webhookEvent,
        }),
      });

      if (!res.ok) {
        console.error('[PayPal Webhook] Verify API error:', res.status, await res.text());
        return false;
      }

      const result = await res.json();
      return result.verification_status === 'SUCCESS';
    } catch (error) {
      console.error('[PayPal Webhook] Signature verification exception:', error);
      return false;
    }
  }
}
