import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PayPalService } from "@/lib/server/payments/paypal";

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    // 1. Fetch Merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, available_balance, available_balance_usd, kyc_status, paypal_enabled, has_usd_account")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" }, { status: 404 });
    }

    if (merchant.kyc_status !== 'approved') {
      return NextResponse.json({ error: "Verification KYC requise.", code: "KYC_REQUIRED" }, { status: 403 });
    }

    const balance = merchant.available_balance;
    const balanceUsd = merchant.available_balance_usd;
    const environment = 'live';
    const usdAccount = await PayPalService.getMerchantUsdAccountState(merchant);
    const balances: Record<string, number> = { HTG: Number(balance || 0) };
    if (usdAccount.isActive) balances.USD = Number(balanceUsd || 0);

    // 2. Fetch Withdrawals
    const { data: withdrawals } = await supabaseAdmin
      .from("withdrawals")
      .select("id, amount, status, created_at, kobara_reference, provider, wallet, total, fees, currency, payout_currency, payout_amount, exchange_rate")
      .eq("merchant_id", merchant.id)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(20);

    // 3. Fetch B2B Sent Transfers
    const { data: sentTransfers } = await supabaseAdmin
      .from("b2b_transfers")
      .select("id, amount, status, created_at, receiver:merchants!receiver_id(business_name)")
      .eq("sender_id", merchant.id)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(20);

    // 4. Fetch B2B Received Transfers
    const { data: receivedTransfers } = await supabaseAdmin
      .from("b2b_transfers")
      .select("id, amount, status, created_at, sender:merchants!sender_id(business_name)")
      .eq("receiver_id", merchant.id)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(20);

    // 5. Combine and format
    let history: any[] = [];

    if (withdrawals) {
      withdrawals.forEach((w: any) => {
        const methodDisplay =
          w.provider?.toLowerCase().includes('natcash') || w.method?.toLowerCase().includes('natcash')
            ? 'NatCash'
            : w.provider?.toLowerCase().includes('zelle') || w.method?.toLowerCase().includes('zelle')
            ? 'Zelle'
            : w.provider?.toLowerCase().includes('paypal') || w.method?.toLowerCase().includes('paypal')
            ? 'PayPal'
            : 'MonCash';

        history.push({
          id: w.id,
          type: 'withdrawal',
          title: `Retrait ${methodDisplay}`,
          amount: w.amount,
          amount_type: 'negative',
          status: w.status,
          date: w.created_at,
          kobara_reference: w.kobara_reference,
          method: methodDisplay,
          provider: methodDisplay,
          wallet: w.wallet,
          total: w.total,
          fees: w.fees,
          currency: w.currency || 'HTG',
          payout_currency: w.payout_currency || w.currency || 'HTG',
          payout_amount: w.payout_amount || w.amount,
          exchange_rate: w.exchange_rate || 1,
        });
      });
    }

    if (sentTransfers) {
      sentTransfers.forEach((t: any) => {
        const receiverName = t.receiver?.business_name || 'Inconnu';
        history.push({
          id: t.id,
          type: 'transfer_sent',
          title: `Transfert vers ${receiverName}`,
          amount: t.amount,
          amount_type: 'negative',
          status: t.status,
          date: t.created_at
        });
      });
    }

    if (receivedTransfers) {
      receivedTransfers.forEach((t: any) => {
        const senderName = t.sender?.business_name || 'Inconnu';
        history.push({
          id: t.id,
          type: 'transfer_received',
          title: `Transfert reçu de ${senderName}`,
          amount: t.amount,
          amount_type: 'positive',
          status: t.status,
          date: t.created_at
        });
      });
    }

    // Sort by date DESC and take top 50
    history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    history = history.slice(0, 50);

    return NextResponse.json({
      success: true,
      balance: balance || 0,
      currency: 'HTG',
      balances,
      usd_account: {
        created: usdAccount.hasAccount,
        active: usdAccount.isActive,
        status: usdAccount.status,
      },
      history
    });

  } catch (error: any) {
    console.error("API /mobile/balance error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
