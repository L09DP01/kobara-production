import { NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { getWebAuthnConfig } from '@/lib/server/passkey-config';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { user, merchant, supabase } = await getCurrentUserAndMerchant();

    const { data: settings } = await supabase.from('settings').select('security_json').eq('merchant_id', merchant.id).single();
    const security = settings?.security_json || {};
    const expectedChallenge = security.current_challenge;

    if (!expectedChallenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 400 });
    }

    const { rpID, expectedOrigin } = getWebAuthnConfig(req);

    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      // Ensure passkeys array exists
      const existingPasskeys = security.passkeys || [];
      
      const newPasskey = {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports || body.response.transports || [],
        created_at: new Date().toISOString()
      };

      existingPasskeys.push(newPasskey);

      const updatedSecurity = {
        ...security,
        passkeys: existingPasskeys,
        current_challenge: null // Clear challenge
      };

      await supabase.from('settings').update({ security_json: updatedSecurity }).eq('merchant_id', merchant.id);

      // Trigger notification for added passkey
      try {
        const { notifyPasskeyAdded } = await import('@/lib/server/notifications');
        await notifyPasskeyAdded(merchant.id, user.email!);
      } catch (e) {
        console.error("Passkey notification failed", e);
      }

      return NextResponse.json({ verified: true });
    }

    return NextResponse.json({ verified: false }, { status: 400 });
  } catch (error: any) {
    console.error('verify-registration error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
