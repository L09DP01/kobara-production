import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@/auth";
import { getKycMerchantId } from "@/lib/server/auth/handoff-auth";

const CHALLENGES = [
  'blink_twice',
  'turn_head_left',
  'turn_head_right',
  'smile'
];

export async function POST(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await getKycMerchantId(request);
    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Pick a random challenge
    const challenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    
    // Expires in 3 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 3);

    // Save challenge
    const { data: record, error } = await supabase.from('kyc_liveness_challenges').insert({
      merchant_id: merchantId,
      challenge_type: challenge,
      expires_at: expiresAt.toISOString()
    }).select('id, challenge_type').single();

    if (error || !record) {
      console.error("Liveness start error:", error);
      return NextResponse.json({ error: "Impossible d'initialiser le défi Liveness" }, { status: 500 });
    }

    // Update kyc_profiles with this challenge ID
    await supabase.from('kyc_profiles').update({ liveness_challenge_id: record.id }).eq('merchant_id', merchantId);

    // Provide friendly instruction based on challenge
    let instruction = '';
    switch(challenge) {
      case 'blink_twice': instruction = "Clignez des yeux deux fois"; break;
      case 'turn_head_left': instruction = "Tournez la tête vers la gauche"; break;
      case 'turn_head_right': instruction = "Tournez la tête vers la droite"; break;
      case 'smile': instruction = "Faites un grand sourire"; break;
    }

    return NextResponse.json({ 
      id: record.id,
      challenge_type: record.challenge_type,
      instruction 
    });

  } catch (error) {
    console.error("Liveness start error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
