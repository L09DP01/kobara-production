import { NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { getWebAuthnConfig } from '@/lib/server/passkey-config';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    const { email, assertionResponse } = await req.json();

    if (!assertionResponse) {
      return NextResponse.json({ error: 'Assertion response required' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const cookieStore = await cookies();
    const cookieChallenge = cookieStore.get('kbr_passkey_challenge')?.value;

    const credentialId = assertionResponse.id;
    const cleanEmail = email ? (email as string).toLowerCase().trim() : '';

    let matchedUser: any = null;
    let matchedMerchant: any = null;
    let matchedPasskey: any = null;
    let securityObj: any = null;
    let expectedChallenge: string | null = cookieChallenge || null;

    // A. If email is provided, try to find user first
    if (cleanEmail) {
      const { data: user } = await supabase
        .from('users')
        .select('id, email, is_active')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (user && user.is_active !== false) {
        const { data: merchant } = await supabase
          .from('merchants')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (merchant) {
          const { data: settings } = await supabase
            .from('settings')
            .select('security_json')
            .eq('merchant_id', merchant.id)
            .maybeSingle();

          const security = settings?.security_json || {};
          const passkeys = security.passkeys || [];
          const foundPk = passkeys.find((pk: any) => pk.id === credentialId);
          if (foundPk) {
            matchedUser = user;
            matchedMerchant = merchant;
            matchedPasskey = foundPk;
            securityObj = security;
            if (security.auth_challenge) {
              expectedChallenge = security.auth_challenge;
            }
          }
        }
      }
    }

    // B. If not found by email (or no email entered), search ALL settings rows globally by passkey credentialId
    if (!matchedPasskey) {
      const { data: allSettings } = await supabase
        .from('settings')
        .select('merchant_id, security_json')
        .not('security_json', 'is', null);

      if (allSettings) {
        for (const st of allSettings) {
          const pks = st.security_json?.passkeys || [];
          const found = pks.find((pk: any) => pk.id === credentialId);
          if (found) {
            matchedMerchant = { id: st.merchant_id };
            matchedPasskey = found;
            securityObj = st.security_json;
            if (st.security_json?.auth_challenge) {
              expectedChallenge = st.security_json.auth_challenge;
            }
            break;
          }
        }
      }

      if (matchedMerchant) {
        // Fetch merchant details to get user_id
        const { data: merchantData } = await supabase
          .from('merchants')
          .select('user_id')
          .eq('id', matchedMerchant.id)
          .maybeSingle();

        if (merchantData) {
          const { data: userData } = await supabase
            .from('users')
            .select('id, email, is_active')
            .eq('id', merchantData.user_id)
            .maybeSingle();

          if (userData && userData.is_active !== false) {
            matchedUser = userData;
          }
        }
      }
    }

    if (!matchedUser || !matchedPasskey) {
      return NextResponse.json({ error: 'Clé Passkey non reconnue ou aucun compte associé.' }, { status: 400 });
    }

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge d\'authentification manquant ou expiré.' }, { status: 400 });
    }

    // Verify assertion signature
    const publicKeyBytes = Buffer.from(matchedPasskey.publicKey, 'base64url');
    const { rpID, expectedOrigin } = getWebAuthnConfig(req);

    const verification = await verifyAuthenticationResponse({
      response: assertionResponse,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: matchedPasskey.id,
        publicKey: publicKeyBytes,
        counter: matchedPasskey.counter || 0,
        transports: matchedPasskey.transports,
      },
    });

    if (!verification.verified) {
      return NextResponse.json({ error: 'Échec de la vérification de la clé Passkey.' }, { status: 400 });
    }

    // Update counter
    const updatedPasskeys = (securityObj.passkeys || []).map((pk: any) => {
      if (pk.id === credentialId) {
        return { ...pk, counter: verification.authenticationInfo.newCounter };
      }
      return pk;
    });

    await supabase.from('settings').update({
      security_json: {
        ...securityObj,
        passkeys: updatedPasskeys,
        auth_challenge: null,
      }
    }).eq('merchant_id', matchedMerchant.id);

    // Clear challenge cookie
    cookieStore.delete('kbr_passkey_challenge');

    return NextResponse.json({
      verified: true,
      userId: matchedUser.id,
      email: matchedUser.email,
    });

  } catch (error: any) {
    console.error('verify-authentication error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
