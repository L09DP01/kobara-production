import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createAdminClient } from '@/utils/supabase/admin';

const REFERRAL_COOKIE = 'kobara_merchant_referral_code';

export async function GET(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await context.params;
  const code = rawCode.trim().toLowerCase();
  const supabase = createAdminClient();
  const { data: referrer } = await supabase
    .from('merchants')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) {
    return NextResponse.redirect(new URL('/register?referral=invalid', request.url));
  }

  const session = await auth();
  if (session?.user?.id) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (merchant) {
      const { error } = await supabase.rpc('accept_merchant_referral_code', {
        p_referral_code: code,
        p_user_id: session.user.id,
      });
      const destination = error
        ? '/dashboard?referral=unavailable'
        : '/dashboard?referral=accepted';
      const response = NextResponse.redirect(new URL(destination, 'https://dashboard.kobara.app'));
      response.cookies.delete(REFERRAL_COOKIE);
      return response;
    }
  }

  const destination = session?.user?.id ? '/onboarding' : `/register?ref=${encodeURIComponent(code)}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(REFERRAL_COOKIE, code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.kobara.app' : undefined,
  });
  return response;
}
