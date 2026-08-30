import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { auth } from "@/auth";
import { decideKycStatus, KycSignals } from "@/lib/server/kyc/decision-engine";
import { activateFreePlanAfterKyc } from "@/lib/server/plans";
import { createNotification } from "@/lib/server/notifications";

import { uploadLimiter, getClientIp } from "@/lib/server/security/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const { success, reset } = await uploadLimiter.limit(`kyc_submit:${ip}`);
    if (!success) {
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return NextResponse.json(
        { error: "Trop de soumissions KYC. Veuillez patienter avant de réessayer." },
        { 
          status: 429, 
          headers: { 
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Reset': reset.toString() 
          } 
        }
      );
    }

    const session = await auth() as any;
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const { data: merchant } = await supabase.from('merchants').select('id, email, phone, business_name').eq('user_id', session.user.id).single();
    if (!merchant) return NextResponse.json({ error: "Marchand introuvable" }, { status: 404 });
    const merchantId = merchant.id;

    const { data: profile } = await supabase.from('kyc_profiles').select('*').eq('merchant_id', merchantId).single();
    if (!profile) {
      return NextResponse.json({ error: "Profil KYC incomplet" }, { status: 400 });
    }

    // Prepare signals for Decision Engine
    let geminiReview = {};
    const geminiKey = process.env.GEMINI_API_KEY;
    
    // Check missing docs
    const missingDocs = !profile.document_front_url || !profile.selfie_url || (!profile.document_back_url && profile.document_type === 'national_id');

    if (!missingDocs && geminiKey) {
      // Fetch files to send to Gemini for review
      try {
        const { data: frontData } = await supabase.storage.from('kyc_documents').download(profile.document_front_url);
        const { data: selfieData } = await supabase.storage.from('kyc_documents').download(profile.selfie_url);
        
        let backData = null;
        if (profile.document_back_url) {
          const { data: bData } = await supabase.storage.from('kyc_documents').download(profile.document_back_url);
          backData = bData;
        }

        if (frontData && selfieData) {
          const frontBase64 = Buffer.from(await frontData.arrayBuffer()).toString('base64');
          const selfieBase64 = Buffer.from(await selfieData.arrayBuffer()).toString('base64');
          
          const parts = [
            { text: `Tu es un assistant d’analyse KYC pour Kobara.
Tu dois absolument REJETER si les images fournies ne sont pas de vrais documents d'identité ou ne contiennent pas de visage humain clair pour le selfie.
Si tu détectes une photo d'objet aléatoire, de paysage, ou quoi que ce soit d'autre qu'un document officiel et un selfie, ton 'recommended_status' DOIT être 'rejected'.
Si les documents sont valides mais que la qualité est moyenne ou qu'il y a un doute, retourne 'in_review'.
Si tout est parfait, retourne 'approved'.
Retourne uniquement :
{
  "risk_level": "low|medium|high|critical",
  "recommended_status": "approved|in_review|rejected",
  "confidence": 0.0,
  "observations": [],
  "inconsistencies": [],
  "missing_checks": [],
  "admin_summary": "",
  "suggested_next_steps": []
}` },
            { inline_data: { mime_type: "image/jpeg", data: frontBase64 } },
            { inline_data: { mime_type: "image/jpeg", data: selfieBase64 } }
          ];

          if (backData) {
            const backBase64 = Buffer.from(await backData.arrayBuffer()).toString('base64');
            parts.push({ inline_data: { mime_type: "image/jpeg", data: backBase64 } });
          }

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts }] })
          });

          const json = await response.json();
          if (json.candidates && json.candidates[0].content.parts[0].text) {
            let text = json.candidates[0].content.parts[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
            geminiReview = JSON.parse(text);
          }
        }
      } catch (err) {
        console.error("Gemini Assistant Error:", err);
      }
    }

    // Call Decision Engine
    const signals: KycSignals = {
      email_verified: !!merchant.email,
      phone_verified: !!merchant.phone,
      document_type: profile.document_type || 'unknown',
      document_required_sides_present: !missingDocs,
      document_quality_score: 85, // Mocked for MVP, should be returned by OCR/Vision
      document_expired: false,
      ocr_score: 85,
      name_match_score: 85,
      selfie_present: !!profile.selfie_url,
      face_detected: true,
      face_match_score: 85, // Gemini could provide this in real life, mocked here
      liveness_score: profile.liveness_score || 0,
      duplicate_document: false,
      duplicate_phone: false,
      duplicate_selfie: false,
      risk_score: 0,
      gemini_review: geminiReview
    };

    const decision = decideKycStatus(signals);

    // Prepare update
    const updatePayload: any = {
      status: decision.status,
      gemini_review: geminiReview,
      backend_decision: decision,
      risk_score: decision.score,
      rejection_reason: decision.reasons.join(' | ')
    };

    if (decision.status === 'approved') updatePayload.approved_at = new Date().toISOString();
    else if (decision.status === 'rejected') updatePayload.rejected_at = new Date().toISOString();

    // 1. Update KYC Profile
    const { error: profileUpdateError } = await supabase.from('kyc_profiles').update(updatePayload).eq('id', profile.id);
    
    if (profileUpdateError) {
      console.error("KYC Profile Update Error:", profileUpdateError);
      throw new Error("Failed to update KYC profile: " + profileUpdateError.message);
    }

    // 2. Update Merchant Status
    await supabase.from('merchants').update({
      kyc_status: decision.status,
      ...(decision.status === 'approved'
        ? { kyc_verified_at: new Date().toISOString(), current_environment: 'live' }
        : {})
    }).eq('id', merchantId);

    // 3. Post-Decision Actions & Notifications
    if (decision.status === 'approved') {
      try {
         await activateFreePlanAfterKyc(merchantId);
      } catch (e) {
         console.error("Erreur activation plan gratuit:", e);
      }
      await createNotification(merchantId, 'kyc_success', 'Vérification validée', 'Votre identité a été confirmée avec succès.', merchant.email);
    } else {
      // Mode manuel automatique (in_review)
      await createNotification(merchantId, 'kyc_review', 'Vérification en cours', 'Votre dossier a été bien reçu et est en cours d\'examen par notre équipe.', merchant.email);
    }

    // 4. Notification Email aux Administrateurs
    try {
      const { notifyAdminKycSubmission } = await import("@/lib/server/notifications");
      await notifyAdminKycSubmission({
        merchantId,
        businessName: merchant.business_name || merchant.email,
        merchantEmail: merchant.email,
        merchantPhone: merchant.phone,
        documentType: profile.document_type,
        status: decision.status as 'approved' | 'in_review',
        score: decision.score,
        reasons: decision.reasons,
        geminiSummary: (geminiReview as any)?.admin_summary,
      });
    } catch (adminMailErr) {
      console.error("Failed to send admin KYC notification:", adminMailErr);
    }

    // Audit Log
    await supabase.from('kyc_events').insert({
      merchant_id: merchantId,
      kyc_profile_id: profile.id,
      event_type: `kyc.${decision.status}`,
      payload: { decision, signals }
    });

    return NextResponse.json({ success: true, status: decision.status, reasons: decision.reasons });

  } catch (error) {
    console.error("Submit KYC error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
