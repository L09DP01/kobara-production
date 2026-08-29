-- Keep session history while allowing per-device revocation.
ALTER TABLE public.merchant_sessions
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_merchant_last_active
ON public.merchant_sessions (merchant_id, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_sessions_token_status
ON public.merchant_sessions (session_token, status);
