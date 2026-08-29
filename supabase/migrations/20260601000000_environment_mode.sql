-- Migration: Add global test/live environment support
-- 1. Add current_environment to merchants
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS current_environment VARCHAR(20) DEFAULT 'test' CHECK (current_environment IN ('test', 'live'));

-- 2. Add environment column to all relevant tables
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));
ALTER TABLE public.webhook_endpoints ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live'));

-- 3. The api_keys table already has an environment column, but let's ensure it has the check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'api_keys_environment_check'
        AND table_name = 'api_keys'
    ) THEN
        ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_environment_check CHECK (environment IN ('test', 'live'));
    END IF;
END $$;
