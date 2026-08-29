-- Add device/browser detail columns for the dashboard session manager.
ALTER TABLE public.merchant_sessions
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50) DEFAULT 'owner',
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS device_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS browser VARCHAR(120),
ADD COLUMN IF NOT EXISTS browser_version VARCHAR(60),
ADD COLUMN IF NOT EXISTS operating_system VARCHAR(120);

UPDATE public.merchant_sessions AS sessions
SET user_id = merchants.user_id
FROM public.merchants AS merchants
WHERE sessions.user_id IS NULL
  AND sessions.merchant_id = merchants.id;

UPDATE public.merchant_sessions
SET is_active = FALSE
WHERE revoked_at IS NOT NULL OR status = 'revoked';

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_user_active
ON public.merchant_sessions (user_id, is_active, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_merchant_last_active
ON public.merchant_sessions (merchant_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_token_status
ON public.merchant_sessions (session_token, status);
