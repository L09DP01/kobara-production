import { NextRequest, NextResponse } from 'next/server';
import { startShopifyInstall } from '@/lib/server/shopify-install';

export async function GET(request: NextRequest) {
  try { return await startShopifyInstall(request.nextUrl.searchParams); }
  catch {
    return NextResponse.json({ error: 'invalid_installation', message: 'Relancez l’installation depuis Shopify.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
