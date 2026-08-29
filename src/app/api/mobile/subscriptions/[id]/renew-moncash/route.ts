import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { createPaymReference, withPaymentRoutingMetadata, sanitizePaymentRedirectUrl } from "@/lib/payment-routing";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // 1. Vérification auth mobile
    const authResult = await verifyMobileToken(req);
    if (authResult.errorResponse) return authResult.errorResponse;
    
    const userId = authResult.payload?.sub;
    if (!userId) {
      return NextResponse.json({ error: "Utilisateur non identifié", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', userId)
      .single();
      
    const merchantId = merchant?.id;
    if (!merchantId) {
      return NextResponse.json({ error: "Profil marchand requis", code: "MERCHANT_REQUIRED" }, { status: 403 });
    }

    // 2. Vérifier l'abonnement
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*, plans(*)')
      .eq('id', id)
      .eq('merchant_id', merchantId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({ error: "Abonnement introuvable", code: "NOT_FOUND" }, { status: 404 });
    }

    if (subscription.amount_htg <= 0) {
      return NextResponse.json({ error: "Ce plan est gratuit.", code: "INVALID_AMOUNT" }, { status: 400 });
    }

    // 3. Obtenir le Deep Link ou URL de retour de l'app mobile
    const body = await req.json().catch(() => ({}));
    const returnUrl = body.returnUrl || "kobara://payments/success";

    // 4. Créer une intention interne avant de contacter le fournisseur.
    const { createPaymentGateway } = await import("@/lib/server/payments/gateway");
    
    // Le prefix REF:: indique qu'il s'agit d'un renouvellement
    const reference = createPaymReference('RNW');
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        merchant_id: merchantId,
        amount: subscription.amount_htg,
        net_amount: subscription.amount_htg,
        currency: 'HTG',
        status: 'pending',
        provider: 'moncash',
        payment_method: 'moncash',
        kobara_reference: reference,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        success_url: returnUrl,
        error_url: returnUrl,
        metadata: {
          is_subscription_upgrade: true,
          plan_slug: subscription.plans?.slug || '',
          billing_cycle: subscription.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
          renewed_subscription_id: subscription.id,
          expected_amount: Number(subscription.amount_htg),
        },
      })
      .select('id')
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ error: "Impossible de créer le paiement de renouvellement." }, { status: 500 });
    }
    
    let gatewayResponse;
    try {
      gatewayResponse = await createPaymentGateway({
        amount: subscription.amount_htg,
        reference,
        provider: 'moncash',
        description: `Renouvellement Abonnement Kobara - Plan ${subscription.plans?.name || ''}`,
        successUrl: returnUrl,
        cancelUrl: returnUrl,
        errorUrl: returnUrl,
      });
    } catch (error) {
      const { error: discardError } = await supabase
        .from('payments')
        .delete()
        .eq('id', payment.id)
        .eq('status', 'pending');
      if (discardError) {
        console.error(JSON.stringify({ event: 'discard_uninitialized_mobile_payment_failed', payment_id: payment.id, code: discardError.code }));
      }
      throw error;
    }

    const safePaymentUrl = sanitizePaymentRedirectUrl(gatewayResponse.paymentUrl);

    const { error: routingError } = await supabase.from('payments').update({
      provider: gatewayResponse.route.wallet,
      payment_method: gatewayResponse.paymentMethod,
      bazik_order_id: gatewayResponse.processor === 'bazik' ? gatewayResponse.orderId : null,
      metadata: {
        ...withPaymentRoutingMetadata(
          {
            is_subscription_upgrade: true,
            plan_slug: subscription.plans?.slug || '',
            billing_cycle: subscription.billing_cycle === 'yearly' ? 'yearly' : 'monthly',
            renewed_subscription_id: subscription.id,
            expected_amount: Number(subscription.amount_htg),
          },
          gatewayResponse.route,
          gatewayResponse.transactionId,
        ),
        ...(gatewayResponse.processor === 'paym' && safePaymentUrl
          ? { provider_checkout_url: safePaymentUrl }
          : {}),
      },
    }).eq('id', payment.id);
    if (routingError) throw new Error("Impossible d'enregistrer la passerelle de renouvellement.");
    
    if (!safePaymentUrl && !gatewayResponse.isUssd) {
      throw new Error("L'API de paiement n'a pas retourné d'URL de redirection.");
    }

    return NextResponse.json({
      success: true,
      paymentUrl: gatewayResponse.processor === 'paym' && safePaymentUrl
        ? `https://pay.kobara.app/redirect/${payment.id}`
        : safePaymentUrl || null,
      paymentId: payment.id,
      processor: gatewayResponse.processor,
    });

  } catch (error: any) {
    console.error("Renew MonCash API error:", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
