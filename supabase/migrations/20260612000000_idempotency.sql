-- 1. Create idempotency_keys table
CREATE TABLE public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_json JSONB,
    status_code INTEGER,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '24 hours',
    UNIQUE (merchant_id, key, endpoint)
);

-- Enable RLS and add policies for idempotency_keys
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can read their own idempotency keys"
    ON public.idempotency_keys FOR SELECT
    USING (auth.uid() = merchant_id);

CREATE POLICY "Service role has full access to idempotency_keys"
    ON public.idempotency_keys FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Create incoming_webhook_events table for deduplication
CREATE TABLE public.incoming_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id TEXT UNIQUE NOT NULL,
    provider TEXT NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'processed',
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add policies for incoming_webhook_events
ALTER TABLE public.incoming_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to incoming_webhook_events"
    ON public.incoming_webhook_events FOR ALL
    USING (true)
    WITH CHECK (true);

-- 3. Update notifications table to support deduplication
-- Check if resource_id exists, if not, add it
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema='public' AND table_name='notifications' AND column_name='resource_id') THEN
        ALTER TABLE public.notifications ADD COLUMN resource_id VARCHAR(255);
    END IF;
END $$;

-- Drop unique constraint if it already exists to be safe
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS uq_merchant_type_resource;

-- Add a unique constraint that allows NULLs (by using a COALESCE or just unique index, but unique constraint on resource_id will fail if multiple rows have NULL resource_id).
-- Wait, in Postgres < 15, multiple NULLs in a UNIQUE constraint don't violate uniqueness.
-- But to be completely safe, we can use a UNIQUE INDEX where resource_id IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_merchant_type_resource 
    ON public.notifications (merchant_id, type, resource_id) 
    WHERE resource_id IS NOT NULL;
