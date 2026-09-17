import 'server-only';

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createAdminClient } from '@/utils/supabase/admin';
import { NowPaymentsSDK } from '@nowpaymentsio/nowpayments-sdk-nodejs';
import {
  isKobaraCryptoCurrency,
  isNowPaymentsTerminalFailure,
  getCryptoWithdrawalMinimumUsd,
  type KobaraCryptoCurrencyId,
} from '@/lib/nowpayments';

const NOWPAYMENTS_API_BASE = 'https://api.nowpayments.io/v1';

type NowPaymentsEnvironmentName =
  | 'NOWPAYMENTS_API_KEY'
  | 'NOWPAYMENTS_IPN_SECRET'
  | 'NOWPAYMENTS_EMAIL'
  | 'NOWPAYMENTS_PASSWORD'
  | 'NOWPAYMENTS_2FA_SECRET';

export function getNowPaymentsEnvironmentValue(name: NowPaymentsEnvironmentName): string {
  try {
    const env = getCloudflareContext().env as CloudflareEnv
      & Partial<Record<NowPaymentsEnvironmentName, string>>;
    const bindingValue = env[name];
    if (typeof bindingValue === 'string' && bindingValue.trim()) {
      return bindingValue.trim();
    }
  } catch {
    // The Cloudflare request context is unavailable in local Node.js execution.
  }

  return process.env[name]?.trim() || '';
}

export function isNowPaymentsConfigured(): boolean {
  return Boolean(
    getNowPaymentsEnvironmentValue('NOWPAYMENTS_API_KEY')
    && getNowPaymentsEnvironmentValue('NOWPAYMENTS_IPN_SECRET'),
  );
}

export function isNowPaymentsPayoutConfigured(): boolean {
  return isNowPaymentsConfigured()
    && Boolean(getNowPaymentsEnvironmentValue('NOWPAYMENTS_EMAIL'))
    && Boolean(getNowPaymentsEnvironmentValue('NOWPAYMENTS_PASSWORD'))
    && Boolean(getNowPaymentsEnvironmentValue('NOWPAYMENTS_2FA_SECRET'));
}

export interface NowPaymentsCheckout {
  payment_id: string;
  order_id: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: KobaraCryptoCurrencyId;
  pay_address: string;
  payin_extra_id: string | null;
  payment_status: string;
  network: string | null;
  valid_until: string | null;
}

export interface NowPaymentsPayment {
  payment_id: string | number;
  payment_status: string;
  price_amount: number;
  price_currency: string;
  pay_amount?: number;
  actually_paid?: number;
  pay_currency?: string;
  order_id: string;
  purchase_id?: string;
  outcome_amount?: number;
  outcome_currency?: string;
  updated_at?: string;
}

function getApiKey(): string {
  const apiKey = getNowPaymentsEnvironmentValue('NOWPAYMENTS_API_KEY');
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY est manquante.');
  return apiKey;
}

function getNowPaymentsSdk() {
  return new NowPaymentsSDK({
    apiKey: getApiKey(),
    ipnSecret: getNowPaymentsEnvironmentValue('NOWPAYMENTS_IPN_SECRET'),
    ipnCallbackUrl: 'https://api.kobara.app/webhooks/nowpayments',
    timeoutMs: 15_000,
  });
}

function getNowPaymentsPayoutSdk() {
  if (!isNowPaymentsPayoutConfigured()) {
    throw new Error('Les retraits crypto ne sont pas encore configurés.');
  }
  return new NowPaymentsSDK({
    apiKey: getApiKey(),
    ipnSecret: getNowPaymentsEnvironmentValue('NOWPAYMENTS_IPN_SECRET'),
    email: getNowPaymentsEnvironmentValue('NOWPAYMENTS_EMAIL'),
    password: getNowPaymentsEnvironmentValue('NOWPAYMENTS_PASSWORD'),
    twoFactorSecret: getNowPaymentsEnvironmentValue('NOWPAYMENTS_2FA_SECRET'),
    payoutIpnCallbackUrl: 'https://api.kobara.app/webhooks/nowpayments/payouts',
    timeoutMs: 20_000,
  });
}

export interface NowPaymentsPayoutQuote {
  currency: KobaraCryptoCurrencyId;
  payoutUsd: number;
  payoutCrypto: number;
  networkFeeCrypto: number;
  networkFeeUsd: number;
  kobaraFeeUsd: number;
  combinedFeeUsd: number;
  totalDebitUsd: number;
  minimumUsd: number;
}

export async function quoteNowPaymentsPayout(input: {
  payoutUsd: number;
  currency: string;
  address: string;
  extraId?: string | null;
}): Promise<NowPaymentsPayoutQuote> {
  const currency = input.currency.trim().toLowerCase();
  if (!isKobaraCryptoCurrency(currency)) throw new Error('Devise crypto non supportée.');
  const minimumUsd = getCryptoWithdrawalMinimumUsd(currency);
  if (!Number.isFinite(input.payoutUsd) || input.payoutUsd < minimumUsd) {
    throw new Error(`Le retrait minimum sur ce réseau est de ${minimumUsd} USD.`);
  }

  const sdk = getNowPaymentsPayoutSdk();
  await sdk.validatePayoutAddress({ address: input.address.trim(), currency, extraId: input.extraId || null });
  const estimate = await sdk.estimatePrice({ amount: input.payoutUsd, fromCurrency: 'usd', toCurrency: currency });
  const payoutCrypto = Number(estimate.estimated_amount);
  if (!Number.isFinite(payoutCrypto) || payoutCrypto <= 0) throw new Error('Le taux crypto est indisponible.');
  const feeEstimate = await sdk.getPayoutFeeEstimate({ currency, amount: payoutCrypto });
  const networkFeeCrypto = Number(feeEstimate.fee || 0);
  const feeUsdEstimate = networkFeeCrypto > 0
    ? await sdk.estimatePrice({ amount: networkFeeCrypto, fromCurrency: currency, toCurrency: 'usd' })
    : null;
  const networkFeeUsd = Number(Number(feeUsdEstimate?.estimated_amount || 0).toFixed(2));
  const kobaraFeeUsd = 0.5;
  const combinedFeeUsd = Number((networkFeeUsd + kobaraFeeUsd).toFixed(2));

  return {
    currency,
    payoutUsd: Number(input.payoutUsd.toFixed(2)),
    payoutCrypto,
    networkFeeCrypto,
    networkFeeUsd,
    kobaraFeeUsd,
    combinedFeeUsd,
    totalDebitUsd: Number((input.payoutUsd + combinedFeeUsd).toFixed(2)),
    minimumUsd,
  };
}

export async function createNowPaymentsPayout(input: {
  withdrawalId: string;
  address: string;
  extraId?: string | null;
  quote: NowPaymentsPayoutQuote;
}) {
  const sdk = getNowPaymentsPayoutSdk();
  return sdk.createPayout({
    address: input.address.trim(),
    currency: input.quote.currency,
    amount: input.quote.payoutCrypto,
    fiatAmount: input.quote.payoutUsd,
    fiatCurrency: 'usd',
    extraId: input.extraId || null,
    uniqueExternalId: input.withdrawalId,
    payoutDescription: `Retrait Kobara ${input.withdrawalId}`,
    networkFeePaidBy: 'sender',
  });
}

export async function getNowPaymentsPayout(payoutId: string) {
  return getNowPaymentsPayoutSdk().getPayoutStatus(payoutId);
}

export async function applyNowPaymentsPayoutStatus(payout: {
  id: string | null;
  status: string;
  batch_withdrawal_id?: string | null;
  hash?: string | null;
  error?: unknown;
}) {
  if (!payout.id) throw new Error('Identifiant de retrait NOWPayments manquant.');
  const supabase = createAdminClient();
  const { data: withdrawal } = await supabase
    .from('withdrawals')
    .select('*')
    .eq('nowpayments_payout_id', payout.id)
    .maybeSingle();
  if (!withdrawal) throw new Error('Retrait Kobara introuvable.');

  const providerResponse = JSON.parse(JSON.stringify(payout));
  if (payout.status === 'finished') {
    return supabase.rpc('complete_automatic_withdrawal', {
      p_withdrawal_id: withdrawal.id,
      p_provider_transaction_id: payout.id,
      p_provider_response: providerResponse,
    });
  }
  if (['failed', 'rejected', 'cancelled', 'canceled'].includes(payout.status)) {
    return supabase.rpc('fail_and_refund_withdrawal', {
      p_withdrawal_id: withdrawal.id,
      p_reason: `NOWPayments: ${payout.status}`,
      p_provider_response: providerResponse,
    });
  }
  return supabase.from('withdrawals').update({ provider_response: providerResponse }).eq('id', withdrawal.id);
}

async function nowPaymentsRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${NOWPAYMENTS_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getApiKey(),
      ...init.headers,
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? String(payload.message)
      : `HTTP ${response.status}`;
    throw new Error(`NOWPayments a refusé la requête: ${message}`);
  }
  return payload as T;
}

export async function createNowPaymentsCheckout(input: {
  paymentId: string;
  amountUsd: number;
  description: string;
  payCurrency: string;
}): Promise<NowPaymentsCheckout> {
  const payCurrency = input.payCurrency.trim().toLowerCase();
  if (!isKobaraCryptoCurrency(payCurrency)) {
    throw new Error('Cette devise ou ce réseau crypto n’est pas autorisé.');
  }

  const payment = await getNowPaymentsSdk().createDirectPayment({
    amount: input.amountUsd,
    currency: 'usd',
    payCurrency,
    // Same-currency settlement prevents NOWPayments from exchanging the asset.
    payoutCurrency: payCurrency,
    orderId: input.paymentId,
    description: input.description,
    fixedRate: true,
    feePaidByUser: false,
  });

  if (!payment.payment_id
      || !payment.pay_address
      || !payment.pay_amount
      || payment.order_id !== input.paymentId
      || payment.pay_currency !== payCurrency) {
    throw new Error('NOWPayments a retourné une instruction de paiement incomplète.');
  }

  return {
    payment_id: String(payment.payment_id),
    order_id: String(payment.order_id),
    price_amount: Number(payment.price_amount),
    price_currency: String(payment.price_currency || 'usd'),
    pay_amount: Number(payment.pay_amount),
    pay_currency: payCurrency,
    pay_address: payment.pay_address,
    payin_extra_id: payment.payin_extra_id || null,
    payment_status: payment.payment_status || 'waiting',
    network: payment.network || null,
    valid_until: payment.valid_until || payment.expiration_estimate_date || null,
  };
}

export async function getNowPaymentsPayment(paymentId: string): Promise<NowPaymentsPayment> {
  const payment = await nowPaymentsRequest<NowPaymentsPayment>(
    `/payment/${encodeURIComponent(paymentId)}`,
    { method: 'GET' },
  );
  if (!payment?.payment_id || !payment.order_id || !payment.payment_status) {
    throw new Error('NOWPayments a retourné un paiement incomplet.');
  }
  return payment;
}

export async function reconcilePendingNowPayments(limit = 50) {
  const supabase = createAdminClient();
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, nowpayments_payment_id, status')
    .eq('environment', 'live')
    .eq('provider', 'crypto')
    .in('status', ['pending', 'expired'])
    .not('nowpayments_payment_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error(`Lecture des paiements crypto impossible: ${error.message}`);

  let updated = 0;
  let failed = 0;
  for (const payment of payments || []) {
    try {
      const providerPayment = await getNowPaymentsPayment(String(payment.nowpayments_payment_id));
      const result = await applyNowPaymentsStatus(providerPayment);
      if (result.transitioned || result.payment?.status !== payment.status) updated += 1;
    } catch (reconciliationError) {
      failed += 1;
      console.warn(`[NOWPayments] Background reconciliation failed for ${payment.id}:`, reconciliationError);
    }
  }
  return { checked: payments?.length || 0, updated, failed };
}

function safeProviderPayload(payment: NowPaymentsPayment) {
  return {
    payment_id: String(payment.payment_id),
    payment_status: payment.payment_status,
    price_amount: payment.price_amount,
    price_currency: payment.price_currency,
    pay_amount: payment.pay_amount ?? null,
    actually_paid: payment.actually_paid ?? null,
    pay_currency: payment.pay_currency ?? null,
    purchase_id: payment.purchase_id ?? null,
    outcome_amount: payment.outcome_amount ?? null,
    outcome_currency: payment.outcome_currency ?? null,
    updated_at: payment.updated_at ?? null,
  };
}

export async function applyNowPaymentsStatus(payment: NowPaymentsPayment) {
  const supabase = createAdminClient();
  const providerPaymentId = String(payment.payment_id);
  const { data: kobaraPayment, error } = await supabase
    .from('payments')
    .select('*')
    .eq('id', payment.order_id)
    .maybeSingle();

  if (error || !kobaraPayment) throw new Error('Paiement Kobara introuvable.');
  if (kobaraPayment.provider !== 'crypto') throw new Error('Le fournisseur du paiement ne correspond pas.');
  if (kobaraPayment.nowpayments_payment_id
      && kobaraPayment.nowpayments_payment_id !== providerPaymentId) {
    throw new Error('Ce paiement est déjà lié à une autre transaction crypto.');
  }
  if (String(payment.price_currency).toUpperCase() !== 'USD') {
    throw new Error('La transaction NOWPayments doit être libellée en USD.');
  }

  const expectedUsd = Number(kobaraPayment.amount_usd);
  const verifiedUsd = Number(payment.price_amount);
  if (!Number.isFinite(expectedUsd) || expectedUsd <= 0
      || !Number.isFinite(verifiedUsd) || Math.abs(expectedUsd - verifiedUsd) > 0.01) {
    throw new Error('Le montant vérifié ne correspond pas à la facture Kobara.');
  }

  const providerPayload = safeProviderPayload(payment);
  const metadata = {
    ...(kobaraPayment.metadata || {}),
    payment_processor: 'nowpayments',
    nowpayments_payment_id: providerPaymentId,
    crypto_currency: payment.pay_currency || null,
    nowpayments_status: payment.payment_status,
  };

  if (payment.payment_status === 'finished') {
    if (kobaraPayment.status === 'succeeded') {
      return { payment: kobaraPayment, transitioned: false };
    }
    if (!['pending', 'expired'].includes(kobaraPayment.status)) {
      throw new Error(`Ce paiement ne peut plus être finalisé (${kobaraPayment.status}).`);
    }

    const { data: updated, error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'succeeded',
        paid_at: new Date().toISOString(),
        provider: 'crypto',
        payment_method: payment.pay_currency || 'crypto',
        payment_source: 'crypto',
        nowpayments_payment_id: providerPaymentId,
        nowpayments_payment_payload: providerPayload,
        metadata,
      })
      .eq('id', kobaraPayment.id)
      .in('status', ['pending', 'expired'])
      .select('*')
      .maybeSingle();

    if (updateError) throw new Error(`Finalisation crypto impossible: ${updateError.message}`);
    if (!updated) {
      const { data: concurrent } = await supabase
        .from('payments')
        .select('*')
        .eq('id', kobaraPayment.id)
        .maybeSingle();
      if (concurrent?.status === 'succeeded'
          && concurrent.nowpayments_payment_id === providerPaymentId) {
        return { payment: concurrent, transitioned: false };
      }
      throw new Error('Le paiement a changé pendant sa finalisation.');
    }

    const { onPaymentSucceeded } = await import('./on-payment-succeeded');
    await onPaymentSucceeded(updated.id);
    return { payment: updated, transitioned: true };
  }

  const nextStatus = isNowPaymentsTerminalFailure(payment.payment_status)
    ? (payment.payment_status === 'refunded' ? 'refunded' : payment.payment_status)
    : 'pending';
  if (kobaraPayment.status === 'succeeded' && nextStatus !== 'refunded') {
    return { payment: kobaraPayment, transitioned: false };
  }
  const { data: updated, error: updateError } = await supabase
    .from('payments')
    .update({
      status: nextStatus,
      payment_method: payment.pay_currency || kobaraPayment.payment_method || 'crypto',
      nowpayments_payment_id: providerPaymentId,
      nowpayments_payment_payload: providerPayload,
      metadata,
    })
    .eq('id', kobaraPayment.id)
    .eq('status', nextStatus === 'refunded' ? 'succeeded' : 'pending')
    .select('*')
    .maybeSingle();
  if (updateError) throw new Error(`Mise à jour crypto impossible: ${updateError.message}`);
  return { payment: updated || kobaraPayment, transitioned: false };
}
