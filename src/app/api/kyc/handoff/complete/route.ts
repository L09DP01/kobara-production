import { NextRequest, NextResponse } from "next/server";
import { getKycMerchantId } from "@/lib/server/auth/handoff-auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await getKycMerchantId(request);
    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Marquer le handoff comme complété
    const { error } = await supabase
      .from('kyc_profiles')
      .update({ mobile_handoff_completed: true })
      .eq('merchant_id', merchantId);

    if (error) {
      console.error("Erreur lors de la complétion du handoff:", error);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur complete handoff:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
