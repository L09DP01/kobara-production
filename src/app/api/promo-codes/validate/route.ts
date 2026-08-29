import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/utils/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { promoCode, planSlug, billingCycle } = await request.json();

    if (!promoCode || !planSlug) {
      return NextResponse.json({ error: "Champs manquants" }, { status: 400 });
    }

    const supabase = createAdminClient();
    
    // Get merchant
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', (session.user as any).id)
      .single();

    if (!merchant) {
      return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
    }

    // Get plan
    const { data: plan } = await supabase
      .from('plans')
      .select('id, price_htg')
      .eq('slug', planSlug)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
    }

    // Check promo code
    const { data: promoData } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('code', promoCode)
      .single();
    
    if (!promoData) {
      return NextResponse.json({ error: "Code promo invalide" }, { status: 400 });
    }
    if (!promoData.is_active) {
      return NextResponse.json({ error: "Ce code promo n'est plus actif" }, { status: 400 });
    }
    if (promoData.expires_at && new Date(promoData.expires_at) < new Date()) {
      return NextResponse.json({ error: "Ce code promo est expiré" }, { status: 400 });
    }
    if (promoData.max_uses && promoData.current_uses >= promoData.max_uses) {
      return NextResponse.json({ error: "Ce code promo a atteint sa limite d'utilisation" }, { status: 400 });
    }
    if (promoData.plan_id && promoData.plan_id !== plan.id) {
      return NextResponse.json({ error: "Ce code promo n'est pas applicable à ce plan" }, { status: 400 });
    }
    if (promoData.merchant_id && promoData.merchant_id !== merchant.id) {
      return NextResponse.json({ error: "Ce code promo n'est pas applicable à votre compte" }, { status: 400 });
    }
    if (billingCycle === 'yearly' && !promoData.is_cumulable) {
      return NextResponse.json({ error: "Ce code promo n'est pas cumulable avec l'offre annuelle (-20%)" }, { status: 400 });
    }

    // Calcul du nouveau prix
    let basePrice = plan.price_htg;
    let originalPrice = basePrice;
    if (billingCycle === 'yearly') {
        basePrice = (plan.price_htg * 0.8) * 12;
        originalPrice = basePrice;
    }

    let finalPrice = basePrice * (1 - (promoData.discount_percentage / 100));
    finalPrice = Math.round(finalPrice * 100) / 100;

    return NextResponse.json({ 
      valid: true, 
      discount_percentage: promoData.discount_percentage,
      original_price: originalPrice,
      final_price: finalPrice
    });

  } catch (error: any) {
    console.error("Promo code validation error", error);
    return NextResponse.json({ error: "Erreur lors de la validation du code promo" }, { status: 500 });
  }
}
