import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { KycFraudEngine } from '@/lib/server/kyc/fraud-engine';

export async function POST(req: NextRequest) {
  try {
    const { merchant, user } = await getCurrentUserAndMerchant();
    if (!merchant || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await req.json();
    const { payoutMethod, payoutAccountNumber, payoutAccountName, documentProofUrl } = body;

    if (!payoutAccountNumber || !payoutAccountName) {
      return NextResponse.json({ error: "Champs obligatoires manquants" }, { status: 400 });
    }

    const res = await KycFraudEngine.submitClosurePayoutInstructions({
      merchantId: merchant.id,
      payoutMethod: payoutMethod || 'moncash',
      payoutAccountNumber,
      payoutAccountName,
      documentProofUrl,
    });

    return NextResponse.json(res);
  } catch (error: any) {
    console.error("Closure payout submission error:", error);
    return NextResponse.json({ error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
