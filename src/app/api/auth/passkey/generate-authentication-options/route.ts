import { NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getWebAuthnConfig } from '@/lib/server/passkey-config';
import { cookies } from 'next/headers';
import { getAccountSecurity } from '@/lib/server/account-settings';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email ? (body.email as string).toLowerCase().trim() : '';

    const supabase = createAdminClient();
    const { rpID } = getWebAuthnConfig(req);

    let allowCredentials: any[] = [];
    let merchantIdToUpdate: string | null = null;
    let securityObject: any = null;

    if (email) {
      // 1. Get user by email if provided
      const { data: user } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle();
      if (user) {
        const { merchant, security } = await getAccountSecurity(user.id);
        if (merchant) {
          securityObject = security;
          const passkeys = securityObject.passkeys || [];
          if (passkeys.length > 0) {
            allowCredentials = passkeys.map((pk: any) => ({
              id: pk.id,
              type: 'public-key',
            }));
            merchantIdToUpdate = merchant.id;
          }
        }
      }
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    // Store challenge in HTTP-only cookie for verification
    const cookieStore = await cookies();
    cookieStore.set('kbr_passkey_challenge', options.challenge, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 300 // 5 minutes
    });

    if (merchantIdToUpdate && securityObject) {
      await supabase.from('settings').update({
        security_json: { ...securityObject, auth_challenge: options.challenge }
      }).eq('merchant_id', merchantIdToUpdate);
    }

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('generate-auth-options error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
