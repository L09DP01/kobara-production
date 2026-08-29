-- Migration: 20260819180000_step_up_login_security.sql
-- Description: Authentification renforcée basée sur le risque (Step-Up Email OTP lors d'une nouvelle IP ou d'un nouvel appareil)

-- 1. Table des contextes de connexion de confiance (trusted_login_contexts)
CREATE TABLE IF NOT EXISTS public.trusted_login_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    ip_hash TEXT NOT NULL,
    ip_masked VARCHAR(64),
    device_fingerprint TEXT,
    user_agent_hash TEXT,
    country_code VARCHAR(10) DEFAULT 'HT',
    first_seen_at TIMESTAMPTZ DEFAULT now(),
    last_seen_at TIMESTAMPTZ DEFAULT now(),
    verified_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '90 days'),
    is_trusted BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_merchant_ip_device UNIQUE (merchant_id, ip_hash, device_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_trusted_contexts_merchant ON public.trusted_login_contexts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contexts_user ON public.trusted_login_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contexts_ip_hash ON public.trusted_login_contexts(ip_hash);
CREATE INDEX IF NOT EXISTS idx_trusted_contexts_device ON public.trusted_login_contexts(device_fingerprint);

-- 2. Table des défis de sécurité de connexion (login_security_challenges)
CREATE TABLE IF NOT EXISTS public.login_security_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    challenge_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    device_fingerprint TEXT,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_challenges_merchant ON public.login_security_challenges(merchant_id);
CREATE INDEX IF NOT EXISTS idx_security_challenges_user ON public.login_security_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_security_challenges_expires ON public.login_security_challenges(expires_at);

-- 3. RLS
ALTER TABLE public.trusted_login_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_security_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on trusted_login_contexts" ON public.trusted_login_contexts
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on login_security_challenges" ON public.login_security_challenges
    FOR ALL USING (auth.role() = 'service_role');
