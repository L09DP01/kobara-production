import { NextRequest, NextResponse } from 'next/server';
import { requireShopifyOwnerMerchant } from '@/lib/server/shopify-auth';
import { claimShopifyInstall, SHOPIFY_INSTALL_COOKIE } from '@/lib/server/shopify-install';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  try {
    const { merchant } = await requireShopifyOwnerMerchant();
    if (merchant.kyc_status !== 'approved') throw new Error('kyc_required');
    await claimShopifyInstall(request.cookies.get(SHOPIFY_INSTALL_COOKIE)?.value, merchant.id);
    const response = NextResponse.redirect(new URL('/integrations/shopify?connected=1', request.url), 303);
    response.cookies.set(SHOPIFY_INSTALL_COOKIE, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(new URL('/integrations/shopify?error=link_failed', request.url), 303);
  }
}
