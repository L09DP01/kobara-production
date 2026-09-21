import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getRuntimeEnvironmentValue } from "@/lib/server/runtime-env";

export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>, 
  supabaseAccessToken?: string
) => {
  const supabaseUrl = getRuntimeEnvironmentValue("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = getRuntimeEnvironmentValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        headers: supabaseAccessToken ? {
          Authorization: `Bearer ${supabaseAccessToken}`,
        } : undefined,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
