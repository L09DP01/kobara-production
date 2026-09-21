import { createClient } from '@supabase/supabase-js';
import { getRuntimeEnvironmentValue } from '@/lib/server/runtime-env';

export const createAdminClient = () => {
  const supabaseUrl = getRuntimeEnvironmentValue('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseServiceKey = getRuntimeEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase admin environment variables. Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
