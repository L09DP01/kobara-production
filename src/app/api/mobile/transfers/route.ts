import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
      .select('id')
      .eq('user_id', userId)
      .single();

    if (senderError || !sender) {
      return NextResponse.json({ error: "Marchand expéditeur introuvable" }, { status: 404 });
    }

    // 2. Get recipient email from recipientId (RPC process_b2b_transfer expects email)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('merchants')
      .select('email')
      .eq('id', recipientId)
      .single();

    if (recipientError || !recipient) {
      return NextResponse.json({ error: "Marchand destinataire introuvable" }, { status: 404 });
    }

    // 3. Call the RPC function process_b2b_transfer
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('process_b2b_transfer', {
      p_sender_id: sender.id,
      p_receiver_email: recipient.email,
      p_amount: Number(amount),
      p_environment: 'live' // Force live environment for the MVP
    });

    if (rpcError) {
      console.error("RPC Error:", rpcError);
      return NextResponse.json({ error: "Erreur lors de la transaction." }, { status: 500 });
    }

    // The RPC returns a JSON object like { success: true/false, error: 'msg', ... }
    const responseData = result as any;

    if (responseData && responseData.success === false) {
      return NextResponse.json({ error: responseData.error }, { status: 400 });
    }

    // Success
    return NextResponse.json({ 
      success: true, 
      transfer: responseData 
    });
    
  } catch (error: any) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}
