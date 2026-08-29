import jwt from 'jsonwebtoken';

/**
 * Creates a JWT that Supabase will accept to authenticate requests via RLS.
 * This is meant to bridge NextAuth and Supabase so we don't have to bypass RLS.
 */
export function signSupabaseToken(userId: string, email?: string) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  
  if (!secret) {
    throw new Error('Missing SUPABASE_JWT_SECRET environment variable.');
  }

  const payload = {
    aud: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24 hours
    sub: userId,
    email: email,
    app_metadata: {
      provider: 'credentials',
      providers: ['credentials'],
    },
    user_metadata: {},
    role: 'authenticated',
  };

  return jwt.sign(payload, secret);
}
