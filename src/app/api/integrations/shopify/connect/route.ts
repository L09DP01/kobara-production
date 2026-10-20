import { NextRequest, NextResponse } from 'next/server';
import { requireShopifyOwnerMerchant } from '@/lib/server/shopify-auth';
import {
  normalizeShopDomain,
  prepareShopifyOAuthConnection,
} from '@/lib/server/shopify';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { merchant } = await requireShopifyOwnerMerchant();
    if (merchant.kyc_status !== 'approved') {
      return NextResponse.redirect(new URL('/integrations/shopify?error=kyc_required', request.url));
    }

    const shopDomain = normalizeShopDomain(request.nextUrl.searchParams.get('shop') || '');
    const authorizationUrl = await prepareShopifyOAuthConnection({
      merchantId: merchant.id,
      shopDomain,
    });
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    console.error('[Shopify] OAuth start failed.');
    const message = error instanceof Error ? error.message : 'connection_failed';
    const code = message === 'unauthorized' ? 'unauthorized'
      : message === 'owner_required' ? 'owner_required'
      : message.includes('myshopify.com') ? 'invalid_shop'
      : 'connection_failed';
    return NextResponse.redirect(new URL(`/integrations/shopify?error=${code}`, request.url));
  }
}
