-- Customer records are isolated between test and live environments. The
-- original unique constraints predated the environment column and therefore
-- rejected a valid live customer when the same contact existed in test mode.

UPDATE public.customers
SET environment = 'test'
WHERE environment IS NULL;

ALTER TABLE public.customers
  ALTER COLUMN environment SET DEFAULT 'test',
  ALTER COLUMN environment SET NOT NULL;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_merchant_id_email_key,
  DROP CONSTRAINT IF EXISTS customers_merchant_id_phone_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_merchant_environment_email_key'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_merchant_environment_email_key
        UNIQUE (merchant_id, environment, email);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.customers'::regclass
      AND conname = 'customers_merchant_environment_phone_key'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_merchant_environment_phone_key
        UNIQUE (merchant_id, environment, phone);
  END IF;
END;
$$;
