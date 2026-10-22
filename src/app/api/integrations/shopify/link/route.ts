import { NextRequest, NextResponse } from 'next/server';
import { requireShopifyOwnerMerchant } from '@/lib/server/shopify-auth';
import { claimShopifyInstall, getShopifyInstallHandoff, SHOPIFY_INSTALL_COOKIE } from '@/lib/server/shopify-install';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  try {
    const { merchant } = await requireShopifyOwnerMerchant();
    if (merchant.kyc_status !== 'approved') throw new Error('kyc_required');
    const proof = request.cookies.get(SHOPIFY_INSTALL_COOKIE)?.value;
    if (request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')
      && (await request.formData()).get('mode') === 'refresh') {
      const handoff = await getShopifyInstallHandoff(proof);
      const existing = await createAdminClient().from('shopify_installations')
        .select('shop_domain, status').eq('merchant_id', merchant.id).maybeSingle();
      if (existing.error || !handoff || existing.data?.status !== 'active'
        || existing.data.shop_domain !== handoff.shop_domain) throw new Error('refresh_shop_mismatch');
    }
    await claimShopifyInstall(proof, merchant.id);
    const response = NextResponse.redirect(new URL('/integrations/shopify?connected=1', request.url), 303);
    response.cookies.set(SHOPIFY_INSTALL_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL('/integrations/shopify?error=link_failed', request.url), 303);
  }
}
