-- 1. Table for User OTPs (for Email 2FA)
CREATE TABLE IF NOT EXISTS public.user_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) DEFAULT 'login_2fa',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookup
CREATE INDEX IF NOT EXISTS idx_user_otps_email ON public.user_otps(email);

-- Enable RLS (Only backend should access this, so no public policies needed, service role bypasses RLS)
ALTER TABLE public.user_otps ENABLE ROW LEVEL SECURITY;

-- 2. Add 2FA and role config fields
-- Ensure merchant_members has right defaults
ALTER TABLE public.merchant_members ALTER COLUMN role SET DEFAULT 'developer';
ALTER TABLE public.merchant_members ALTER COLUMN status SET DEFAULT 'pending';

-- Add 2fa_enabled to settings.security_json if it's not handled via code alone
-- (In Postgres, JSONB fields don't need ALTER TABLE for new keys, we just update the json)

-- 3. Update or drop the get_current_merchant_id function if needed
-- We'll keep it for existing RLS policies but make it handle developer roles correctly
CREATE OR REPLACE FUNCTION get_current_merchant_id() RETURNS UUID AS $$
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM public.merchant_members WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;
