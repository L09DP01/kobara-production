import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getCurrentAccountSecurity } from '@/lib/server/account-settings';
import { getWebAuthnConfig } from '@/lib/server/passkey-config';

export async function GET(req: Request) {
  try {
    const { user, merchant, supabase, security } = await getCurrentAccountSecurity();
    const { rpID, rpName } = getWebAuthnConfig(req);
    
    // Fallback simple string to Uint8Array if helper not found
    const userID = new Uint8Array(Buffer.from(user.id));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID,
      userName: user.email!,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Store the challenge in settings to verify later
    const { error } = await supabase.from('settings').upsert({
      merchant_id: merchant.id,
      security_json: { ...security, current_challenge: options.challenge }
    }, { onConflict: 'merchant_id' });
    if (error) throw new Error('Impossible de preparer la cle de securite.');

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('generate-registration-options error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
