import { NextRequest, NextResponse } from 'next/server';
import { requireShopifyOwnerMerchant } from '@/lib/server/shopify-auth';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  try {
    const { merchant, supabase } = await requireShopifyOwnerMerchant();
    const now = new Date().toISOString();
    const { data: installation, error } = await supabase
      .from('shopify_installations')
      .update({
        status: 'disconnected',
        access_token_ciphertext: null,
        oauth_state_hash: null,
        disconnected_at: now,
        updated_at: now,
      })
      .eq('merchant_id', merchant.id)
      .select('id, shop_domain')
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (installation) {
      const { error: linkError } = await supabase.from('payment_links').update({ status: 'inactive' })
        .eq('merchant_id', merchant.id).eq('metadata->>shopify_installation_id', installation.id);
      if (linkError) throw new Error('link_invalidation_failed');
    }

    if (installation) {
      await Promise.allSettled([
        supabase.from('audit_logs').insert({
          merchant_id: merchant.id,
          action: 'shopify.disconnected',
          entity_type: 'shopify_installation',
          entity_id: installation.id,
          metadata: { shop_domain: installation.shop_domain },
        }),
        supabase.from('notifications').insert({
          merchant_id: merchant.id,
          type: 'shopify_disconnected',
          title: 'Shopify déconnecté',
          message: "La boutique Shopify a été déconnectée de Kobara.",
        }),
      ]);
    }
    return NextResponse.redirect(new URL('/integrations/shopify?disconnected=1', request.url), 303);
  } catch {
    console.error('[Shopify] Disconnect failed.');
    return NextResponse.redirect(new URL('/integrations/shopify?error=disconnect_failed', request.url), 303);
  }
}
