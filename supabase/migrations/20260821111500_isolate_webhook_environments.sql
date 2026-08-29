-- Enforce strict test/live isolation for outgoing webhook deliveries.

UPDATE public.webhook_endpoints
SET environment = 'test'
WHERE environment IS NULL;

UPDATE public.webhook_events AS event
SET environment = payment.environment
FROM public.payments AS payment
WHERE event.payload #>> '{data,id}' = payment.id::text
  AND payment.environment IN ('test', 'live')
  AND event.environment IS DISTINCT FROM payment.environment;

UPDATE public.webhook_events
SET environment = 'test'
WHERE environment IS NULL;

ALTER TABLE public.webhook_endpoints
  ALTER COLUMN environment SET DEFAULT 'test',
  ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.webhook_events
  ADD COLUMN IF NOT EXISTS event_key TEXT,
  ALTER COLUMN environment SET DEFAULT 'test',
  ALTER COLUMN environment SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_endpoints_id_environment_key
  ON public.webhook_endpoints (id, environment);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'webhook_events_endpoint_environment_fkey'
      AND conrelid = 'public.webhook_events'::regclass
  ) THEN
    ALTER TABLE public.webhook_events
      ADD CONSTRAINT webhook_events_endpoint_environment_fkey
      FOREIGN KEY (webhook_endpoint_id, environment)
      REFERENCES public.webhook_endpoints (id, environment)
      ON DELETE CASCADE
      NOT VALID;

    ALTER TABLE public.webhook_events
      VALIDATE CONSTRAINT webhook_events_endpoint_environment_fkey;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_events_event_key_key
  ON public.webhook_events (event_key)
  WHERE event_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_endpoints_merchant_environment_status_idx
  ON public.webhook_endpoints (merchant_id, environment, status);

CREATE INDEX IF NOT EXISTS webhook_events_merchant_environment_created_idx
  ON public.webhook_events (merchant_id, environment, created_at DESC);
