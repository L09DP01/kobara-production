import { NextRequest, NextResponse } from 'next/server';
import { startShopifyInstall } from '@/lib/server/shopify-install';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    return await startShopifyInstall(request.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'shopify_installation_required', message: 'Ouvrez Kobara Connect depuis Shopify.' }, { status: 400 });
  }
}
