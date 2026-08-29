'use server'

import { createAdminClient } from "@/utils/supabase/admin";
import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import { createKycProfile, calculateKycRiskScore, createKycAuditLog } from "@/lib/server/kyc";

export async function uploadKycDocument(formData: FormData, documentType: string, documentCountry: string, fullName: string) {
  try {
    const { merchant } = await getCurrentUserAndMerchant();
    if (!merchant) return { error: "Non autorisé. Marchand introuvable." };

    const frontFile = formData.get('front') as File;
    const backFile = formData.get('back') as File | null;
    const selfieFile = formData.get('selfie') as File;

    if (!frontFile || !selfieFile) {
      return { error: "Le recto du document et le selfie sont requis." };
    }

    const supabase = createAdminClient();

    const uploadFile = async (file: File, type: string) => {
      const ext = file.name.split('.').pop();
      const fileName = `${merchant.id}/${type}_${Date.now()}.${ext}`;
      
      // We convert File to ArrayBuffer to Buffer for Supabase Storage
      const buffer = Buffer.from(await file.arrayBuffer());
      
      const { data, error } = await supabase.storage
        .from('kyc_documents')
        .upload(fileName, buffer, {
          contentType: file.type,
          upsert: true
        });
        
      if (error) throw new Error(`Échec de l'upload (${type}): ${error.message}`);
      return data.path;
    };

    const frontPath = await uploadFile(frontFile, 'front');
    const backPath = backFile ? await uploadFile(backFile, 'back') : null;
    const selfiePath = await uploadFile(selfieFile, 'selfie');

    // Create profile
    await createKycProfile(merchant.id, {
      document_type: documentType,
      document_country: documentCountry,
      full_name: fullName,
      document_front_url: frontPath,
      document_back_url: backPath,
      selfie_url: selfiePath,
      submitted_at: new Date().toISOString()
    });

    // Run scoring
    const result = await calculateKycRiskScore(merchant.id);

    return { success: true, status: result.status, riskScore: result.riskScore };
  } catch (error: any) {
    console.error("KYC Upload Error:", error);
    return { error: "Erreur lors de la soumission du KYC: " + error.message };
  }
}

export async function getKycStatus() {
  const { merchant } = await getCurrentUserAndMerchant();
  if (!merchant) return null;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('kyc_profiles')
    .select('*')
    .eq('merchant_id', merchant.id)
    .single();

  return profile;
}
