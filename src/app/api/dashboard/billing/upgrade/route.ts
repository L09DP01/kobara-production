import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { notifyMerchantPlanTransition, upgradeMerchantPlan } from '@/lib/server/plans';
import { createAdminClient } from '@/utils/supabase/admin';
import {
  createPaymReference,
  normalizePaymAmount,
  withPaymentRoutingMetadata,
} from '@/lib/payment-routing';
import {
  createPaymentGateway,
  getPaymentProviderConfig,
} from '@/lib/server/payments/gateway';

const PAYMENT_METHODS = new Set(['balance', 'moncash', 'natcash']);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const planSlug = String(body.planSlug || '');
    const billingCycle = body.billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const paymentMethod = String(body.paymentMethod || '');
    const promoCode = body.promoCode ? String(body.promoCode).trim().toUpperCase() : '';
    if (!planSlug) return NextResponse.json({ error: 'planSlug is required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, email, kyc_status, plan_slug')
      .eq('user_id', (session.user as { id: string }).id)
      .single();
    if (!merchant) return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    if (merchant.kyc_status !== 'approved') {
      return NextResponse.json({ error: 'Le KYC doit être approuvé pour choisir un plan' }, { status: 403 });
    }

    const { data: plan } = await supabase
      .from('plans')
      .select('id, slug, price_htg, name, status')
      .eq('slug', planSlug)
      .eq('status', 'active')
      .single();
    if (!plan) return NextResponse.json({ error: 'Plan introuvable' }, { status: 404 });

    let discountPercentage = 0;
    let promoCodeId: string | null = null;
    if (promoCode) {
      const { data: promo } = await supabase.from('promo_codes').select('*').eq('code', promoCode).single();
      const invalidPromo = !promo
        || !promo.is_active
        || (promo.expires_at && new Date(promo.expires_at) <= new Date())
        || (promo.max_uses && promo.current_uses >= promo.max_uses)
        || (promo.plan_id && promo.plan_id !== plan.id)
        || (promo.merchant_id && promo.merchant_id !== merchant.id)
        || (billingCycle === 'yearly' && !promo.is_cumulable);
      if (invalidPromo) return NextResponse.json({ error: 'Code promo invalide ou non applicable' }, { status: 400 });
      discountPercentage = Math.min(100, Math.max(0, Number(promo.discount_percentage || 0)));
      promoCodeId = promo.id;
    }

    const baseAmount = billingCycle === 'yearly'
      ? Number(plan.price_htg) * 0.8 * 12
      : Number(plan.price_htg);
    let amount = Math.round(baseAmount * (1 - discountPercentage / 100) * 100) / 100;

    if (Number(plan.price_htg) === 0 || plan.slug === 'free') {
      await upgradeMerchantPlan(merchant.id, plan.slug, {
        billingCycle: 'monthly',
        amountHTG: 0,
        paymentStatus: 'not_required',
        source: 'free',
      });
      return NextResponse.json({ success: true, requiresPayment: false, message: 'Plan gratuit activé' });
    }

    if (amount === 0 && promoCodeId) {
      await upgradeMerchantPlan(merchant.id, plan.slug, {
        billingCycle,
        amountHTG: 0,
        paymentStatus: 'not_required',
        source: 'promo',
        promoCodeId,
      });
      return NextResponse.json({ success: true, requiresPayment: false, message: 'Plan activé avec le code promo' });
    }

    if (!PAYMENT_METHODS.has(paymentMethod)) {
      return NextResponse.json({ error: 'Méthode de paiement invalide' }, { status: 400 });
    }

    if (paymentMethod === 'balance') {
      const balanceRpc = promoCodeId
        ? 'purchase_subscription_from_balance_with_promo'
        : 'purchase_subscription_from_balance';
      const { data: subscriptionId, error } = await supabase.rpc(balanceRpc, {
        p_merchant_id: merchant.id,
        p_plan_id: plan.id,
        p_billing_cycle: billingCycle,
        p_amount_htg: amount,
        ...(promoCodeId ? { p_promo_code_id: promoCodeId } : { p_activation_source: 'balance' }),
      });
      if (error) {
        const message = error.message.includes('insufficient_balance')
          ? 'Solde insuffisant pour effectuer ce paiement.'
          : `Impossible d’activer le plan: ${error.message}`;
        return NextResponse.json({ error: message }, { status: 400 });
      }
      try {
        await notifyMerchantPlanTransition({
          merchantId: merchant.id,
          email: merchant.email,
          previousPlanSlug: merchant.plan_slug,
          newPlan: plan,
          source: 'balance',
          resourceId: String(subscriptionId),
        });
      } catch (notificationError) {
        console.error('Balance subscription notification failed:', notificationError);
      }
      return NextResponse.json({ success: true, requiresPayment: false, message: 'Plan activé via le solde' });
    }

    const providerConfig = await getPaymentProviderConfig();
    const walletProvider = paymentMethod === 'natcash' ? 'natcash' : 'moncash';
    if (walletProvider === 'natcash' && providerConfig.active_provider === 'paym') {
      amount = normalizePaymAmount('natcash', amount);
    }

    const subscriptionMetadata = {
      is_subscription_upgrade: true,
      plan_slug: plan.slug,
      billing_cycle: billingCycle,
      promo_code_id: promoCodeId,
      expected_amount: amount,
    };

    const nowIso = new Date().toISOString();
    let payment: any = null;
    let reference = '';
    let isReused = false;

    const { data: existingSubPayment } = await supabase
      .from('payments')
      .select('id, kobara_reference, metadata, expires_at, status')
      .eq('merchant_id', merchant.id)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .filter('metadata->is_subscription_upgrade', 'eq', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingSubPayment) {
      payment = existingSubPayment;
      reference = existingSubPayment.kobara_reference;
      isReused = true;

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from('payments')
        .update({
          amount,
          net_amount: amount,
          provider: walletProvider,
          payment_method: paymentMethod,
          expires_at: expiresAt,
          metadata: {
            ...(existingSubPayment.metadata || {}),
            ...subscriptionMetadata,
          },
        })
        .eq('id', existingSubPayment.id);
    } else {
      reference = createPaymReference('SUB');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const { data: newPayment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          merchant_id: merchant.id,
          amount,
          net_amount: amount,
          currency: 'HTG',
          status: 'pending',
          provider: walletProvider,
          payment_method: paymentMethod,
          kobara_reference: reference,
          expires_at: expiresAt,
          metadata: subscriptionMetadata,
        })
        .select('id')
        .single();
      if (paymentError || !newPayment) throw new Error('Erreur lors de la création du paiement d’abonnement.');
      payment = newPayment;
    }

    try {
      let gatewayRes: Awaited<ReturnType<typeof createPaymentGateway>>;
      try {
        gatewayRes = await createPaymentGateway({
          amount,
          reference,
          provider: walletProvider,
          description: `Abonnement Kobara - Plan ${plan.name} (${billingCycle === 'yearly' ? 'Annuel' : 'Mensuel'})`,
          successUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app'}/pay/plan-success?payment_id=${payment.id}`,
          cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app'}/dashboard/billing`,
          errorUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app'}/dashboard/billing`,
        });
      } catch (initializationError) {
        if (!isReused) {
          const { error: discardError } = await supabase
            .from('payments')
            .delete()
            .eq('id', payment.id)
            .eq('status', 'pending');
          if (discardError) {
            console.error(JSON.stringify({ event: 'discard_uninitialized_subscription_payment_failed', payment_id: payment.id, code: discardError.code }));
          }
        }
        throw initializationError;
      }

      let referenceCode: string | null = null;
      if (gatewayRes.processor === 'sms_gateway') {
        const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const digits = '23456789';
        const pick = (characters: string) => characters[Math.floor(Math.random() * characters.length)];
        referenceCode = `KOB${pick(digits)}${pick(letters)}${pick(digits)}${pick(letters)}${pick(digits)}`;
      }

      let paymentTarget: URL | null = null;
      if (gatewayRes.paymentUrl) {
        paymentTarget = new URL(gatewayRes.paymentUrl);
        if (paymentTarget.protocol !== 'https:') {
          throw new Error("L’URL de paiement retournée n’est pas sécurisée.");
        }
      }

      const { error: routingError } = await supabase.from('payments').update({
        provider: paymentMethod,
        payment_method: gatewayRes.paymentMethod,
        reference_code: referenceCode,
        bazik_order_id: gatewayRes.processor === 'bazik' ? gatewayRes.orderId : null,
        metadata: {
          ...withPaymentRoutingMetadata(
            subscriptionMetadata,
            gatewayRes.route,
            gatewayRes.transactionId,
          ),
          ...(gatewayRes.processor === 'paym' && paymentTarget
            ? { provider_checkout_url: paymentTarget.toString() }
            : {}),
        },
      }).eq('id', payment.id);
      if (routingError) throw new Error("Impossible d'enregistrer la passerelle de l'abonnement.");

      if (gatewayRes.processor === 'sms_gateway' && referenceCode) {
        return NextResponse.json({
          success: true,
          requiresPayment: true,
          method: 'natcash',
          referenceCode,
          paymentId: payment.id,
        });
      }

      const paymentUrl = paymentTarget?.toString() || null;
      if (!paymentUrl && !gatewayRes.isUssd) {
        throw new Error("L’API de paiement n’a pas retourné d’URL de redirection.");
      }
      const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kobara.app';
      const redirectPath = gatewayRes.processor === 'paym' && paymentUrl
        ? `${appBaseUrl}/pay/redirect/${payment.id}`
        : paymentUrl || `${appBaseUrl}/pay/checkout/${payment.id}?mode=processing&method=${gatewayRes.paymentMethod}`;

      return NextResponse.json({ 
        success: true, 
        requiresPayment: true, 
        method: walletProvider,
        paymentUrl: redirectPath,
        paymentId: payment.id 
      });
    } catch (error) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id);
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server Error';
    console.error(JSON.stringify({ event: 'subscription_upgrade_failed', message }));
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
