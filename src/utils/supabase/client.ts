import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
    { global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      const selected = typeof document !== 'undefined'
        ? document.cookie.match(/(?:^|;\s*)kobara_active_merchant=([^;]*)/)?.[1] : undefined;
      if (selected) headers.set('x-kobara-merchant-id', selected);
      else headers.delete('x-kobara-merchant-id');
      return fetch(input, { ...init, headers });
    } } },
  );
