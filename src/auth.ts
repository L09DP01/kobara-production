import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { supabaseAdmin } from "@/lib/supabase/admin"
import bcrypt from "bcryptjs"
import { SignJWT } from "jose"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Vérifier dans la table users (Supabase) via service_role
        const { data: user, error } = await supabaseAdmin
          .from("users")
          .select("id, email, password_hash, role, is_active")
          .eq("email", email)
          .single()

        if (error || !user) {
          console.error("Auth error:", error?.message || "User not found")
          return null
        }

        if (user.is_active === false) {
          console.error("User inactive")
          return null
        }

        // Comparer le hash bcrypt
        const isValidPassword = await bcrypt.compare(password, user.password_hash)

        if (!isValidPassword) {
          return null
        }

        return { 
          id: user.id, 
          email: user.email, 
          role: user.role,
          authMethod: 'password' as string,
        }
      },
    }),

    // Provider Passkey — vérifie l'assertion WebAuthn via SimpleWebAuthn
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: {
        email: { label: "Email", type: "text" },
        assertionResponse: { label: "Assertion", type: "text" },
      },
      authorize: async (credentials) => {
        if (!credentials?.assertionResponse) {
          return null;
        }

        const email = (credentials.email as string || '').toLowerCase().trim();
        const assertionResponse = JSON.parse(credentials.assertionResponse as string);

        try {
          // Appeler la route interne verify-authentication
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const verifyRes = await fetch(`${appUrl}/api/auth/passkey/verify-authentication`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, assertionResponse }),
          });

          if (!verifyRes.ok) {
            const errData = await verifyRes.json().catch(() => ({}));
            console.error("Passkey verify failed:", errData.error);
            return null;
          }

          const result = await verifyRes.json();

          if (!result.verified) {
            return null;
          }

          // Charger l'utilisateur pour la session
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, email, role, is_active")
            .eq("id", result.userId)
            .single();

          if (!user || user.is_active === false) return null;

          return {
            id: user.id,
            email: user.email,
            role: user.role,
            authMethod: 'passkey' as string,
          };
        } catch (e) {
          console.error("Passkey authorization error:", e);
          return null;
        }
      },
    }),

    Credentials({
      id: "mobile-sso",
      name: "Mobile SSO",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      authorize: async (credentials) => {
        if (!credentials?.token) return null;
        
        const tokenStr = credentials.token as string;
        const MOBILE_TOKEN_SECRET = process.env.NEXTAUTH_SECRET || process.env.SUPABASE_JWT_SECRET;
        
        if (!MOBILE_TOKEN_SECRET) {
          console.error("MOBILE_TOKEN_SECRET not found");
          return null;
        }
        
        try {
          const secret = new TextEncoder().encode(MOBILE_TOKEN_SECRET);
          const { jwtVerify } = await import("jose");
          const { payload } = await jwtVerify(tokenStr, secret);
          
          if (!payload.email) return null;
          
          const { data: user } = await supabaseAdmin
            .from("users")
            .select("id, email, role, is_active")
            .eq("email", payload.email)
            .single();
            
          if (!user || user.is_active === false) return null;
          
          return { 
            id: user.id, 
            email: user.email, 
            role: user.role,
            authMethod: 'mobile-sso' as string,
          };
        } catch (e) {
          console.error("SSO token verification failed:", e);
          return null;
        }
      }
    }),
  ],
  callbacks: {
    jwt({ token, user, trigger }) {
      // Injecter le rôle et la méthode d'auth dans le JWT lors du premier signIn
      if (user) {
        token.role = user.role;
        token.authMethod = (user as any).authMethod || 'password';
      }
      return token
    },
    async session({ session, token }) {
      // Exposer le rôle dans la session
      if (session.user) {
        session.user.role = token.role as string
        // Expose l'ID de l'utilisateur
        session.user.id = token.sub as string
        ;(session as any).authMethod = token.authMethod as string || 'password'
        
        // Signer un token Supabase pour que RLS fonctionne (compatible Edge)
        const payload = {
          aud: "authenticated",
          sub: session.user.id,
          email: session.user.email,
          role: "authenticated",
        }
        
        if (process.env.SUPABASE_JWT_SECRET) {
          const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);
          ;(session as any).supabaseAccessToken = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
            .setIssuedAt()
            .setExpirationTime(Math.floor(new Date(session.expires).getTime() / 1000))
            .sign(secret);
        }
      }
      return session
    },
    async signIn({ user, account, profile }) {
      // Envoyer un email de notification de connexion en arrière-plan
      // Ne jamais bloquer la connexion même si l'email échoue
      if (user?.email) {
        const authMethod = (user as any).authMethod || 
          (account?.provider === 'passkey' ? 'passkey' : 
           account?.provider === 'mobile-sso' ? 'mobile-sso' : 'password');

        // Récupérer les headers HTTP pour l'IP et le User-Agent
        let ip = 'unknown';
        let userAgent = 'unknown';
        try {
          const { headers } = await import('next/headers');
          const headersList = await headers();
          ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() 
            || headersList.get('x-real-ip') 
            || 'unknown';
          userAgent = headersList.get('user-agent') || 'unknown';
        } catch (e) {
          console.error('[AUTH] Failed to read headers:', e);
        }

        // Fire-and-forget: l'email est envoyé en arrière-plan
        import('@/lib/server/login-notification').then(async ({ sendLoginNotificationEmail }) => {
          try {
            // Récupérer le nom du marchand pour personnaliser l'email
            const { data: merchant } = await supabaseAdmin
              .from('merchants')
              .select('business_name')
              .eq('user_id', user.id!)
              .maybeSingle();

            await sendLoginNotificationEmail({
              email: user.email!,
              merchantName: merchant?.business_name || undefined,
              ip,
              userAgent,
              method: authMethod as 'password' | 'passkey' | 'mobile-sso',
            });
          } catch (e) {
            console.error('[AUTH] Login notification email failed:', e);
          }
        }).catch(console.error);
      }

      return true; // Toujours autoriser la connexion
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.kobara.app' : 'localhost'
      }
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
})
