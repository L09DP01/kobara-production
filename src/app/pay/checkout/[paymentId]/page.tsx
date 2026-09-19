import { createAdminClient } from "@/utils/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import { CheckoutFormClient } from "./CheckoutFormClient";
import { CryptoCheckout } from './CryptoCheckout';
import { PaymentProcessingLoader } from "@/components/payments/PaymentProcessingLoader";
import { Lock, ShieldCheck } from "lucide-react";
import { getPaymentMethodLabel } from '@/lib/payment-settlement';

export default async function UnifiedCheckoutPage({ 
  params,
  searchParams,
}: { 
  params: Promise<{ paymentId: string }>;
  searchParams?: Promise<{ mode?: string; method?: string; phone?: string }>;
}) {
  const supabaseAdmin = createAdminClient();
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  
  if (!resolvedParams.paymentId) {
    notFound();
  }

  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('*, merchants(business_name, logo_url)')
    .eq('id', resolvedParams.paymentId)
    .single();

  if (!payment || payment.environment !== 'live') {
    notFound();
  }

  // Si on est en mode processing (USSD Loader)
  if (resolvedSearchParams.mode === 'processing') {
    const requestedMethod = resolvedSearchParams.method || payment.payment_method;
    const ussdMethod: 'moncash_ussd' | 'natcash_ussd' | 'moncash' | 'natcash' =
      requestedMethod === 'natcash_ussd' || requestedMethod === 'moncash' || requestedMethod === 'natcash'
        ? requestedMethod
        : 'moncash_ussd';
    const phone = resolvedSearchParams.phone || payment.metadata?.payer_phone || '';

    return (
      <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
        <PaymentProcessingLoader
          paymentId={payment.id}
          amount={Number(payment.amount)}
          currency={payment.currency || 'HTG'}
          phoneNumber={phone}
          method={ussdMethod}
          merchantName={payment.merchants?.business_name || 'Marchand Kobara'}
          successUrl={payment.success_url || undefined}
          expiresAt={payment.expires_at || undefined}
        />
      </div>
    );
  }

  // Check if active
  const isExpired = payment.expires_at && new Date(payment.expires_at) < new Date();
  if (payment.status !== 'pending' || isExpired) {
    if (payment.status === 'succeeded') {
      if (payment.success_url) {
        redirect(payment.success_url);
      } else {
        return (
          <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-lg ambient-shadow">
              <div className="w-16 h-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-3xl">check_circle</span>
              </div>
              <h1 className="text-headline-md font-headline-md text-white mb-2">Paiement réussi</h1>
              <p className="text-slate-400 font-body-base">
                Merci. Votre paiement de <strong className="text-white">{Number(payment.amount).toLocaleString(payment.currency === 'USD' ? 'en-US' : 'fr-HT')} {payment.currency || 'HTG'}</strong> via <strong className="text-white">{getPaymentMethodLabel(payment)}</strong> a été complété avec succès.
              </p>
            </div>
          </div>
        );
      }
    }
    return (
      <div className="min-h-[100dvh] bg-[#0F1626] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center shadow-lg ambient-shadow">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-3xl">error</span>
          </div>
          <h1 className="text-headline-md font-headline-md text-white mb-2">Paiement indisponible</h1>
          <p className="text-slate-400 font-body-base">
            Ce paiement est expiré ou a déjà été traité.
          </p>
        </div>
      </div>
    );
  }

  if (payment.provider === 'crypto') {
    const whiteLabel = payment.metadata?.crypto_white_label || {};
    const merchantName = whiteLabel.label || payment.merchants?.business_name || 'Marchand Kobara';
    const merchantLogo = whiteLabel.logo_url || payment.merchants?.logo_url || null;
    const accentColor = whiteLabel.accent_color || '#F95005';

    return (
      <CryptoCheckout
        paymentId={payment.id}
        reference={payment.kobara_reference || payment.id.slice(0, 8)}
        amountUsd={Number(payment.amount_usd)}
        merchantName={merchantName}
        merchantLogo={merchantLogo}
        accentColor={accentColor}
        initialCurrency={payment.crypto_pay_currency || payment.metadata?.crypto_currency || null}
        existingCheckout={payment.nowpayments_payment_id && payment.crypto_pay_currency && payment.crypto_pay_amount && payment.crypto_pay_address ? {
          providerPaymentId: payment.nowpayments_payment_id,
          payCurrency: payment.crypto_pay_currency,
          payAmount: Number(payment.crypto_pay_amount),
          payAddress: payment.crypto_pay_address,
          extraId: payment.crypto_pay_extra_id || null,
          network: payment.nowpayments_payment_payload?.network || null,
          validUntil: payment.expires_at || payment.nowpayments_payment_payload?.valid_until || null,
          status: payment.metadata?.nowpayments_status || 'waiting',
        } : null}
      />
    );
  }

  const providerConfig = await getPaymentProviderConfig();

  const { PayPalService } = await import("@/lib/server/payments/paypal");
  const { data: merchantData } = await supabaseAdmin
    .from('merchants')
    .select('id, paypal_enabled, has_usd_account')
    .eq('id', payment.merchant_id)
    .maybeSingle();

  const [usdAccount, paymentMethods] = await Promise.all([
    PayPalService.getMerchantUsdAccountState(merchantData),
    getMerchantPaymentMethodState(payment.merchant_id),
  ]);
  const allowCardPayment = usdAccount.isActive;

  return (
    <main className="min-h-[100dvh] bg-[#080E19] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex min-w-0 items-center gap-3">
            {payment.merchants?.logo_url ? (
              <img src={payment.merchants.logo_url} alt={payment.merchants.business_name} className="h-10 w-10 shrink-0 rounded-lg border border-white/10 object-cover" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/10 font-bold text-orange-400">
                {payment.merchants?.business_name?.substring(0, 1).toUpperCase() || 'K'}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{payment.merchants?.business_name || 'Marchand Kobara'}</p>
              <p className="truncate text-xs text-slate-400">Réf. {payment.kobara_reference || payment.reference_code || payment.id.slice(0, 8)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300"><Lock className="h-4 w-4 text-orange-500" /> Sécurisé</div>
        </header>

        <section className="mb-5 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-slate-400">Montant à payer</p>
            <p className="text-3xl font-black text-white">{Number(payment.amount).toLocaleString('fr-FR')} <span className="text-base text-orange-500">HTG</span></p>
          </div>
          {allowCardPayment && (
            <p className="shrink-0 text-sm font-semibold text-sky-400">${(Number(payment.amount) / providerConfig.paypal_htg_per_usd).toFixed(2)} USD</p>
          )}
        </section>

        <section className="rounded-lg border border-white/10 bg-[#101827] p-4 sm:p-6">

          <CheckoutFormClient
            paymentId={payment.id}
            config={providerConfig}
            allowCardPayment={allowCardPayment}
            amountHtg={Number(payment.amount)}
            initialMethod={resolvedSearchParams.method}
            defaultName={payment.metadata?.customer_name || payment.metadata?.name || ''}
            defaultEmail={payment.metadata?.customer_email || payment.metadata?.email || ''}
            defaultPhone={payment.metadata?.phone || payment.metadata?.customer_phone || ''}
          />
        </section>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Paiement chiffré et sécurisé</p>
      </div>
    </main>
  );
}
