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

    if (!file) {
      return NextResponse.json({ error: "Image manquante" }, { status: 400 });
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

    const ext = file.type.split('/')[1];
    const fileName = `${merchantId}/selfie_${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('kyc_documents')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Erreur lors de l'enregistrement de l'image" }, { status: 500 });
    }

    const { data: profile } = await supabase.from('kyc_profiles').select('id').eq('merchant_id', merchantId).single();
    
    if (profile) {
      await supabase.from('kyc_profiles').update({ selfie_url: fileName, selfie_hash: hash }).eq('id', profile.id);
    } else {
      await supabase.from('kyc_profiles').insert({
        merchant_id: merchantId,
        selfie_url: fileName,
        selfie_hash: hash
      });
    }
    
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Capture selfie error:", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}
