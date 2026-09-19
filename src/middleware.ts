import type { NextRequest } from 'next/server';
import { handleRequestProxy } from '@/lib/server/request-proxy';

export function middleware(request: NextRequest) {
  return handleRequestProxy(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
