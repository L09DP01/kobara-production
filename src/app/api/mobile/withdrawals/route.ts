import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { canCreateWithdrawal } from "@/lib/server/access";
import { WithdrawalService } from "@/lib/server/withdrawals/withdrawal.service";
import { getPaymentProviderConfig } from "@/lib/server/payments/gateway";
import { PayPalService } from "@/lib/server/payments/paypal";

export async function POST(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;
    const body = await req.json();
    const { method, amount, reference, idempotency_key, account_currency } = body;

    if (!method || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || !reference) {
      return NextResponse.json({ error: "Données de retrait invalides." }, { status: 400 });
    }

    // 1. Récupérer le marchand
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, email, current_environment, paypal_enabled, has_usd_account')
      .eq('user_id', userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    }

    // 2. Vérifier les limites de forfait / KYC
    const sourceCurrency = String(account_currency || 'HTG').toUpperCase() === 'USD' ? 'USD' : 'HTG';
    const normalizedMethod = String(method || '').trim().toLowerCase();
    if (sourceCurrency === 'USD' || normalizedMethod === 'zelle' || normalizedMethod === 'paypal') {
      const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
      if (!usdAccount.isActive) {
        return NextResponse.json({
          error: 'Le compte USD est indisponible ou suspendu.',
          code: 'USD_ACCOUNT_INACTIVE',
        }, { status: 403 });
      }
    }
    let accessAmountHtg = Number(amount);
    if (sourceCurrency === 'USD') {
      const providerConfig = await getPaymentProviderConfig();
      accessAmountHtg = Number(amount) * Number(providerConfig.paypal_htg_per_usd || 130);
    }
    const accessCheck = await canCreateWithdrawal(merchant.id, accessAmountHtg);
    if (!accessCheck.allowed) {
      const reason = accessCheck.reason === 'kyc_required' 
        ? "Votre compte doit être vérifié (KYC) pour effectuer des retraits."
        : accessCheck.reason === 'subscription_expired'
          ? "Votre abonnement a expiré. Renouvelez-le pour retrouver votre limite Premium."
          : "Vous avez atteint la limite de retrait de votre forfait actuel.";
      return NextResponse.json({
        error: reason,
        code: accessCheck.reason === 'subscription_expired' ? 'SUBSCRIPTION_EXPIRED' : accessCheck.reason,
        renewal_url: accessCheck.reason === 'subscription_expired' ? '/dashboard/billing' : undefined,
      }, { status: 403 });
    }

    const isTest = merchant.current_environment === 'test';

    // 3. Exécution via le service unifié atomique
    const result = await WithdrawalService.processWithdrawal({
      merchantId: merchant.id,
      merchantEmail: merchant.email,
      amount: Number(amount),
      method,
      sourceCurrency,
      receiver: reference,
      idempotencyKey: idempotency_key,
      environment: isTest ? 'test' : 'live',
      description: 'Retrait Kobara (Mobile)',
    });

    if (!result.success && !result.requiresManualApproval) {
      return NextResponse.json({
        error: result.error || "Échec du transfert.",
        refunded: result.refunded || false,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      withdrawal: result.withdrawal,
    });
    
  } catch (error: unknown) {
    console.error("[Mobile Withdrawals Route] Error:", error);
    return NextResponse.json(
      { error: "Erreur interne du serveur lors du retrait." },
      { status: 500 }
    );
  }
}
