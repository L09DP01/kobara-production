import { NextRequest, NextResponse } from "next/server";
import { verifyMobileToken } from "@/lib/auth/mobile-verify";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, current_environment")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" }, { status: 404 });
    }

    const environment = merchant.current_environment || 'test';
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('payment_links')
      .select('id, title, description, amount, currency, status, slug, created_at, expires_at', { count: 'exact' })
      .eq('merchant_id', merchant.id)
      .eq('environment', environment)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    const { data: links, count, error: linksError } = await query;

    if (linksError) {
      console.error("Error fetching mobile payment links:", linksError);
      return NextResponse.json({ error: "Erreur lors de la récupération des liens." }, { status: 500 });
    }

    // Now, let's fetch the payment count for each link
    // Normally this would be a join or aggregate view. For now, we do a quick count per link
    const enrichedLinks = await Promise.all((links || []).map(async (link) => {
      const { count: paymentCount } = await supabaseAdmin
        .from('payments')
        .select('id', { count: 'exact', head: true })
        .eq('payment_link_id', link.id)
        .eq('status', 'succeeded');
      
      return {
        ...link,
        payment_count: paymentCount || 0
      };
    }));

    return NextResponse.json({
      success: true,
      paymentLinks: enrichedLinks,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error: any) {
    console.error("API /mobile/payment-links error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { payload, errorResponse } = await verifyMobileToken(req);
    if (errorResponse) return errorResponse;
    if (!payload || !payload.sub) return NextResponse.json({ error: "Token invalide." }, { status: 401 });

    const userId = payload.sub;

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, current_environment")
      .eq("user_id", userId)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json({ error: "Profil marchand introuvable.", code: "MERCHANT_NOT_FOUND" }, { status: 404 });
    }

    const body = await req.json();
    const { title, description, amount, currency, product_name, product_image, collect_address, shipping_fee, pass_fees_to_customer } = body;

    if (!title || !amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: "Le titre et le montant sont requis." }, { status: 400 });
    }

    const environment = merchant.current_environment || 'test';
    const randomSlug = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    
    const parsedShippingFee = shipping_fee ? parseFloat(shipping_fee) : 0;

    const metadata = {
      ...(product_name && { product_name }),
      ...(product_image && { product_image }),
      ...(collect_address && { collect_address }),
      ...(collect_address && parsedShippingFee > 0 && { shipping_fee: parsedShippingFee }),
      ...(pass_fees_to_customer && { pass_fees_to_customer })
    };

    const { data: link, error: insertError } = await supabaseAdmin
      .from('payment_links')
      .insert({
        merchant_id: merchant.id,
        title: title,
        description: description || null,
        amount: Number(amount),
        currency: currency || 'HTG',
        status: 'active',
        environment: environment,
        slug: randomSlug,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating mobile payment link:", insertError);
      return NextResponse.json({ error: "Erreur lors de la création du lien de paiement." }, { status: 500 });
    }

    return NextResponse.json({ success: true, link });
  } catch (error: any) {
    console.error("API POST /mobile/payment-links error:", error);
    return NextResponse.json({ error: "Erreur serveur interne." }, { status: 500 });
  }
}
