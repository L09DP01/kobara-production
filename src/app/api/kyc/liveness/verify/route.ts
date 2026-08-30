import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getKycMerchantId } from "@/lib/server/auth/handoff-auth";

export async function POST(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await getKycMerchantId(request);
    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const challengeId = formData.get("challengeId") as string;
    
    // We expect 3 to 5 frames
    const frames: Blob[] = [];
    for (let i = 0; i < 5; i++) {
      const frame = formData.get(`frame_${i}`) as Blob;
      if (frame) frames.push(frame);
    }

    if (!challengeId || frames.length < 3) {
      return NextResponse.json({ error: "Données de liveness incomplètes" }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    // Validate Challenge
    const { data: challenge } = await supabase.from('kyc_liveness_challenges').select('*').eq('id', challengeId).single();
    if (!challenge) {
      return NextResponse.json({ error: "Défi introuvable" }, { status: 404 });
    }

    if (new Date(challenge.expires_at) < new Date()) {
      await supabase.from('kyc_liveness_challenges').update({ status: 'expired' }).eq('id', challengeId);
      return NextResponse.json({ error: "Défi expiré, veuillez réessayer" }, { status: 400 });
    }

    if (challenge.status !== 'pending') {
      return NextResponse.json({ error: "Défi déjà traité" }, { status: 400 });
    }

    // Save frames for potential manual review
    // We upload the frames to a specific subfolder
    for (let i = 0; i < frames.length; i++) {
      const buffer = Buffer.from(await frames[i].arrayBuffer());
      const fileName = `${challenge.merchant_id}/liveness_${challengeId}_frame_${i}.webp`;
      await supabase.storage.from('kyc_documents').upload(fileName, buffer, { contentType: 'image/webp', upsert: false });
    }

    // No local heuristic can prove liveness. Keep the evidence for the
    // configured KYC provider or an administrator and fail closed meanwhile.
    const livenessScore = 0;
    const status = 'in_review';

    // Update challenge
    await supabase.from('kyc_liveness_challenges').update({
      status: status,
      result_score: livenessScore,
      completed_at: new Date().toISOString()
    }).eq('id', challengeId);

    // Update profile
    await supabase.from('kyc_profiles').update({
      liveness_score: livenessScore
    }).eq('liveness_challenge_id', challengeId);

    return NextResponse.json({ 
      success: true,
      status,
      score: livenessScore
    });

  } catch (error) {
    console.error("Liveness verify error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
