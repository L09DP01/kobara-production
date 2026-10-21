import { NextRequest, NextResponse } from 'next/server';
import { requireShopifyOwnerMerchant } from '@/lib/server/shopify-auth';
import { isValidShopifyRate } from '@/lib/shopify-policy';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const redirect = (query: string) => NextResponse.redirect(new URL(`/integrations/shopify?${query}`, request.url), 303);
  try {
    const { merchant, supabase } = await requireShopifyOwnerMerchant();
    const form = await request.formData();
    const rate = Number(String(form.get('usd_htg_rate') || '').trim().replace(',', '.'));
    if (!isValidShopifyRate(rate)) return redirect('error=invalid_exchange_rate');
    const { data: installation, error } = await supabase.from('shopify_installations')
      .select('id, metadata').eq('merchant_id', merchant.id).eq('status', 'active').maybeSingle();
    if (error || !installation) return redirect('error=rate_save_failed');
    const result = await supabase.from('shopify_installations').update({
      metadata: { ...installation.metadata, usd_htg_rate: rate }, updated_at: new Date().toISOString(),
    }).eq('id', installation.id).eq('merchant_id', merchant.id).eq('status', 'active').select('id').maybeSingle();
    if (result.error || !result.data) return redirect('error=rate_save_failed');
    return redirect('rate_saved=1');
  } catch {
    return redirect('error=rate_save_failed');
  }
}
