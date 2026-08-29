import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getCurrentUserAndMerchant } from '@/utils/supabase/auth-helper';
import { getWebAuthnConfig } from '@/lib/server/passkey-config';

export async function GET(req: Request) {
  try {
    const { user, merchant, supabase } = await getCurrentUserAndMerchant();
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
    const { data: settings } = await supabase.from('settings').select('security_json').eq('merchant_id', merchant.id).single();
    const security = settings?.security_json || {};
    
    await supabase.from('settings').update({
      security_json: { ...security, current_challenge: options.challenge }
    }).eq('merchant_id', merchant.id);

    return NextResponse.json(options);
  } catch (error: any) {
    console.error('generate-registration-options error:', error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
