import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  getCryptoPaymentExpiresAt,
  getPublicCryptoCheckoutError,
  isKobaraCryptoCurrency,
} from '@/lib/nowpayments';
import {
  createNowPaymentsCheckout,
  getNowPaymentsPaymentMinimum,
  isNowPaymentsConfigured,
} from '@/lib/server/payments/nowpayments';

const requestSchema = z.object({
  paymentId: z.string().uuid(),
  payCurrency: z.string().trim().toLowerCase().refine(isKobaraCryptoCurrency),
}).strict();

interface CryptoPaymentRecord {
  id: string;
  nowpayments_payment_id: string | null;
  metadata: Record<string, unknown> | null;
  crypto_pay_currency: string | null;
  crypto_pay_amount: number | string | null;
  crypto_pay_address: string | null;
  crypto_pay_extra_id: string | null;
  nowpayments_payment_payload: Record<string, unknown> | null;
  expires_at: string | null;
}

function publicCheckout(payment: CryptoPaymentRecord) {
  return {
    paymentId: payment.id,
    providerPaymentId: payment.nowpayments_payment_id,
    status: payment.metadata?.nowpayments_status || 'waiting',
    payCurrency: payment.crypto_pay_currency,
    payAmount: Number(payment.crypto_pay_amount),
    payAddress: payment.crypto_pay_address,
    extraId: payment.crypto_pay_extra_id || null,
    network: typeof payment.nowpayments_payment_payload?.network === 'string'
      ? payment.nowpayments_payment_payload.network
      : null,
    validUntil: payment.expires_at
      || (typeof payment.nowpayments_payment_payload?.valid_until === 'string'
        ? payment.nowpayments_payment_payload.valid_until
        : null),
  };
}

export async function GET(request: NextRequest) {
  try {
    const paymentId = request.nextUrl.searchParams.get('paymentId');
    const payCurrency = request.nextUrl.searchParams.get('payCurrency');
    const parsed = requestSchema.safeParse({ paymentId, payCurrency });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Paramètres crypto invalides.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: payment, error } = await supabase
      .from('payments')
      .select('id, environment, provider, status')
      .eq('id', parsed.data.paymentId)
      .maybeSingle();

    if (error || !payment) return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    if (payment.environment !== 'live' || payment.provider !== 'crypto') {
      return NextResponse.json({ error: 'Ce paiement ne prend pas en charge la crypto.' }, { status: 409 });
    }
    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'Ce paiement n’est plus disponible.' }, { status: 409 });
    }
    if (!isNowPaymentsConfigured()) {
      const configurationError = getPublicCryptoCheckoutError({ code: 'CRYPTO_NOT_CONFIGURED' });
      return NextResponse.json({
        error: configurationError.message,
        code: configurationError.code,
      }, { status: configurationError.status });
    }

    const minimum = await getNowPaymentsPaymentMinimum(parsed.data.payCurrency);
    return NextResponse.json({ data: minimum });
  } catch (error) {
    const publicError = getPublicCryptoCheckoutError(error);
    console.error('[NOWPayments] Minimum lookup failed:', {
      code: publicError.code,
      status: publicError.status,
    });
    return NextResponse.json({
      error: publicError.message,
      code: publicError.code,
    }, { status: publicError.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Paramètres crypto invalides.' }, { status: 400 });
    }

    const { paymentId, payCurrency } = parsed.data;
    const supabase = createAdminClient();
    const { data: payment, error } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .maybeSingle();

    if (error || !payment) return NextResponse.json({ error: 'Paiement introuvable.' }, { status: 404 });
    if (payment.environment !== 'live' || payment.provider !== 'crypto') {
      return NextResponse.json({ error: 'Ce paiement ne prend pas en charge la crypto.' }, { status: 409 });
    }
    if (payment.status !== 'pending') {
      return NextResponse.json({ error: 'Ce paiement n’est plus disponible.' }, { status: 409 });
    }

    if (payment.nowpayments_payment_id) {
      if (payment.crypto_pay_currency !== payCurrency) {
        return NextResponse.json({
          error: 'La devise de ce paiement est déjà définie. Rechargez la page pour continuer.',
        }, { status: 409 });
      }
      return NextResponse.json({ data: publicCheckout(payment) });
    }

    if (!isNowPaymentsConfigured()) {
      const configurationError = getPublicCryptoCheckoutError({ code: 'CRYPTO_NOT_CONFIGURED' });
      console.error('[NOWPayments] Direct checkout is not configured.');
      return NextResponse.json({
        error: configurationError.message,
        code: configurationError.code,
      }, { status: configurationError.status });
    }

    const checkout = await createNowPaymentsCheckout({
      paymentId: payment.id,
      amountUsd: Number(payment.amount_usd),
      description: payment.metadata?.payment_description || `Paiement Kobara ${payment.kobara_reference}`,
      payCurrency,
    });
    const expiresAt = getCryptoPaymentExpiresAt(checkout.valid_until);

    const payload = {
      payment_id: checkout.payment_id,
      payment_status: checkout.payment_status,
      price_amount: checkout.price_amount,
      price_currency: checkout.price_currency,
      pay_amount: checkout.pay_amount,
      pay_currency: checkout.pay_currency,
      network: checkout.network,
      valid_until: expiresAt,
    };
    const metadata = {
      ...(payment.metadata || {}),
      payment_processor: 'nowpayments',
      nowpayments_payment_id: checkout.payment_id,
      nowpayments_status: checkout.payment_status,
      crypto_currency: checkout.pay_currency,
    };

    const { data: bound, error: bindError } = await supabase
      .from('payments')
      .update({
        payment_method: checkout.pay_currency,
        nowpayments_payment_id: checkout.payment_id,
        crypto_pay_currency: checkout.pay_currency,
        crypto_pay_amount: checkout.pay_amount,
        crypto_pay_address: checkout.pay_address,
        crypto_pay_extra_id: checkout.payin_extra_id,
        nowpayments_payment_payload: payload,
        metadata,
        expires_at: expiresAt,
      })
      .eq('id', payment.id)
      .eq('status', 'pending')
      .is('nowpayments_payment_id', null)
      .select('*')
      .maybeSingle();

    if (bindError) throw bindError;
    if (bound) return NextResponse.json({ data: publicCheckout(bound) });

    const { data: concurrent } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .maybeSingle();
    if (concurrent?.nowpayments_payment_id && concurrent.crypto_pay_currency === payCurrency) {
      return NextResponse.json({ data: publicCheckout(concurrent) });
    }
    throw new Error('La transaction a changé pendant son initialisation.');
  } catch (error) {
    const publicError = getPublicCryptoCheckoutError(error);
    const providerError = error && typeof error === 'object'
      ? error as { code?: unknown; httpStatus?: unknown; type?: unknown; details?: unknown }
      : null;
    console.error('[NOWPayments] Direct checkout failed:', {
      code: providerError?.code || publicError.code,
      httpStatus: providerError?.httpStatus || publicError.status,
      type: providerError?.type || 'unknown',
      details: providerError?.details || null,
    });
    return NextResponse.json({
      error: publicError.message,
      code: publicError.code,
    }, { status: publicError.status });
  }
}
