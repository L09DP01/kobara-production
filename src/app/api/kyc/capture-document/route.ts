import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import crypto from 'crypto';
import { auth } from "@/auth";
import { getKycMerchantId } from "@/lib/server/auth/handoff-auth";

export async function POST(request: NextRequest) {
  try {
    const { merchantId, error: authError } = await getKycMerchantId(request);
    if (authError || !merchantId) {
      return NextResponse.json({ error: authError || "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    const documentType = formData.get("documentType") as string;
    const side = formData.get("side") as string; // 'front', 'back', or 'passport_page'

    if (!file || !documentType || !side) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Fichier trop volumineux (max 5MB)" }, { status: 400 });
    }

    const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!mimeTypes.includes(file.type)) {
      return NextResponse.json({ error: "Type de fichier non autorisé" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Merchant ID is already provided by getKycMerchantId

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Generate secure random filename
    const ext = file.type.split('/')[1];
    const fileName = `${merchantId}/${crypto.randomUUID()}.${ext}`;

    // Upload to private bucket
    const { error: uploadError } = await supabase.storage
      .from('kyc_documents') // Existing private bucket
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'image" }, { status: 500 });
    }

    // Update kyc_profiles
    const updateData: any = {};
    if (side === 'front') {
      updateData.document_front_url = fileName;
      updateData.document_front_hash = hash;
      updateData.document_type = documentType;
    } else if (side === 'back') {
      updateData.document_back_url = fileName;
      updateData.document_back_hash = hash;
    } else if (side === 'passport_page') {
      updateData.passport_page_url = fileName;
      updateData.passport_page_hash = hash;
      updateData.document_type = documentType;
    }

    // Ensure a kyc_profile exists for this merchant
    const { data: profile } = await supabase.from('kyc_profiles').select('id').eq('merchant_id', merchantId).single();
    
    if (profile) {
      await supabase.from('kyc_profiles').update(updateData).eq('id', profile.id);
    } else {
      await supabase.from('kyc_profiles').insert({
        merchant_id: merchantId,
        ...updateData
      });
    }

    // Note: OCR could be triggered here asynchronously
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Capture document error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
