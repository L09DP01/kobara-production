import { createAdminClient } from "@/utils/supabase/admin";
import { activateFreePlanAfterKyc } from "./plans";

export async function createKycProfile(merchantId: string, data: any) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('kyc_profiles').insert({
    merchant_id: merchantId,
    status: 'pending',
    ...data
  });
  if (error) throw new Error("Failed to create KYC profile: " + error.message);
  await createKycAuditLog(merchantId, 'kyc.submitted', data);
}

export async function createKycAuditLog(merchantId: string, eventType: string, payload: any = {}) {
  const supabase = createAdminClient();
  
  // Try to get kyc_profile_id
  const { data: profile } = await supabase
    .from('kyc_profiles')
    .select('id')
    .eq('merchant_id', merchantId)
    .single();

  await supabase.from('kyc_events').insert({
    merchant_id: merchantId,
    kyc_profile_id: profile?.id || null,
    event_type: eventType,
    payload: payload
  });
}

export async function calculateKycRiskScore(merchantId: string) {
  const supabase = createAdminClient();
  
  // 1. Fetch the KYC profile
  const { data: profile, error } = await supabase
    .from('kyc_profiles')
    .select('*')
    .eq('merchant_id', merchantId)
    .single();

  if (error || !profile) throw new Error("KYC profile not found");

  // Basic scoring logic based on user rules
  let riskScore = 100; // start perfect
  let rejectionReason = null;

  if (!profile.document_front_url) {
    riskScore -= 50;
    rejectionReason = "Document manquant";
  }
  if (!profile.selfie_url) {
    riskScore -= 50;
    rejectionReason = "Selfie manquant";
  }

  let livenessScore = 0;
  let faceMatchScore = 0;
  let automatedVerificationAvailable = false;

  // Integrate Gemini AI for robust checking if key exists
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && profile.document_front_url && profile.selfie_url) {
    try {
      // In a real scenario, we'd fetch the images from Supabase storage using signedUrls
      // and send base64 to Gemini. For this implementation, since it's a server action,
      // we would need to download the file buffer first.
      
      const { data: frontData } = await supabase.storage.from('kyc_documents').download(profile.document_front_url);
      const { data: selfieData } = await supabase.storage.from('kyc_documents').download(profile.selfie_url);

      if (frontData && selfieData) {
        const frontBase64 = Buffer.from(await frontData.arrayBuffer()).toString('base64');
        const selfieBase64 = Buffer.from(await selfieData.arrayBuffer()).toString('base64');

        const geminiPayload = {
          contents: [{
            parts: [
              { text: "Tu es un expert intraitable en vérification KYC et en sécurité. Je te fournis une pièce d'identité (première image) et un selfie (deuxième image). Ta mission est stricte :\n1. Vérifie que la pièce d'identité est bien nette, lisible, authentique, et sans reflet bloquant.\n2. Vérifie que le selfie est net, que la personne est vivante (liveness) et qu'il ne s'agit pas d'une photo d'une photo ou d'un écran.\n3. Compare méticuleusement les visages des deux photos. Ils doivent correspondre parfaitement.\nSi l'image est floue, mal cadrée, s'il y a un doute sur l'authenticité ou si les visages ne correspondent pas, tu DOIS mettre `isValidDocument: false` et fournir une `reason` claire expliquant pourquoi.\nRéponds uniquement en JSON strict avec ce format : { \"faceMatchScore\": <0-100>, \"livenessScore\": <0-100>, \"isValidDocument\": <true/false>, \"extractedName\": \"<nom sur la carte>\", \"reason\": \"<explication du refus ou de la réussite>\" }" },
              { inline_data: { mime_type: "image/jpeg", data: frontBase64 } },
              { inline_data: { mime_type: "image/jpeg", data: selfieBase64 } }
            ]
          }]
        };

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        const json = await response.json();
        if (json.candidates && json.candidates[0].content.parts[0].text) {
          let text = json.candidates[0].content.parts[0].text;
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const aiResult = JSON.parse(text);
          
          livenessScore = aiResult.livenessScore || 0;
          faceMatchScore = aiResult.faceMatchScore || 0;
          automatedVerificationAvailable = true;

          if (!aiResult.isValidDocument) {
             riskScore -= 30;
             rejectionReason = "Document invalide ou illisible (Détecté par IA)";
          }
        }
      }
    } catch (e) {
      console.error("Gemini AI check failed:", e);
      rejectionReason = "Vérification automatisée indisponible : revue manuelle requise";
    }
  } else {
    rejectionReason = "Vérification automatisée non configurée : revue manuelle requise";
  }

  if (!automatedVerificationAvailable || livenessScore < 75) riskScore -= 20;
  if (!automatedVerificationAvailable || faceMatchScore < 80) riskScore -= 20;

  // Decision: Ne jamais rejeter automatiquement, toujours passer en in_review si score insuffisant
  let newStatus: 'approved' | 'in_review' = 'in_review';
  if (automatedVerificationAvailable && riskScore >= 80 && !rejectionReason) {
    newStatus = 'approved';
  } else {
    newStatus = 'in_review';
  }

  // Update profile
  await supabase.from('kyc_profiles').update({
    status: newStatus,
    liveness_score: livenessScore,
    face_match_score: faceMatchScore,
    risk_score: riskScore,
    rejection_reason: rejectionReason,
    approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
    rejected_at: null
  }).eq('id', profile.id);

  await createKycAuditLog(merchantId, `kyc.${newStatus}`, {
    riskScore,
    livenessScore,
    faceMatchScore,
    automatedVerificationAvailable,
  });

  // Récupérer les informations du marchand pour l'email admin
  const { data: merchant } = await supabase
    .from('merchants')
    .select('business_name, email, phone')
    .eq('id', merchantId)
    .single();

  // Notification automatique aux administrateurs par email
  try {
    const { notifyAdminKycSubmission } = await import('@/lib/server/notifications');
    await notifyAdminKycSubmission({
      merchantId,
      businessName: merchant?.business_name,
      merchantEmail: merchant?.email,
      merchantPhone: merchant?.phone,
      documentType: profile.document_type,
      status: newStatus,
      score: riskScore,
      reasons: rejectionReason ? [rejectionReason] : undefined,
    });
  } catch (notifErr) {
    console.error("Failed to notify admin for KYC submission:", notifErr);
  }

  // If approved, trigger free plan activation
  if (newStatus === 'approved') {
    await approveMerchantKyc(merchantId);
  }

  return { status: newStatus, riskScore, rejectionReason };
}

export async function approveMerchantKyc(merchantId: string) {
  const supabase = createAdminClient();
  
  // 1. Update merchant
  const { error } = await supabase.from('merchants').update({
    kyc_status: 'approved',
    kyc_verified_at: new Date().toISOString(),
    current_environment: 'live',
  }).eq('id', merchantId);

  if (error) throw new Error("Failed to approve merchant: " + error.message);

  // 2. Activate free plan
  await activateFreePlanAfterKyc(merchantId);
}
