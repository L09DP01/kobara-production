import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { B2BTransferService } from "@/lib/server/transfers/b2b-transfer.service";

export async function POST(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;
    const body = await req.json();
    const { recipientId, amount } = body;

    if (!recipientId || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Données de transfert invalides." }, { status: 400 });
    }

    // 1. Get sender merchant ID
    const { data: sender, error: senderError } = await supabaseAdmin
      .from('merchants')
      .select('id, kyc_status')
      .eq('user_id', userId)
      .single();

    if (senderError || !sender) {
      return NextResponse.json({ error: "Marchand expéditeur introuvable" }, { status: 404 });
    }
    if (sender.kyc_status !== 'approved') return NextResponse.json({ error: "Verification KYC requise.", code: "KYC_REQUIRED" }, { status: 403 });

    // 2. Get recipient email from recipientId (RPC process_b2b_transfer expects email)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('merchants')
      .select('email, kyc_status')
      .eq('id', recipientId)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json({ error: "Marchand destinataire introuvable" }, { status: 404 });
    }
    if (recipient.kyc_status !== 'approved') return NextResponse.json({ error: "Le destinataire ne peut pas recevoir de transfert." }, { status: 403 });

    const result = await B2BTransferService.processTransfer({
      senderId: sender.id,
      receiverEmail: recipient.email,
      amount: Number(amount),
      environment: 'live',
      source: 'mobile',
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Erreur lors de la transaction.", code: result.code },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      transfer: result,
    });

  } catch (error: unknown) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
