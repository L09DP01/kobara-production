-- Harden PayPal capture accounting and keep the USD ledger single-entry.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS processor_fee_amount_usd numeric(15,2),
  ADD COLUMN IF NOT EXISTS payment_source text,
  ADD COLUMN IF NOT EXISTS paypal_capture_payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS payments_paypal_order_id_unique
  ON public.payments (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_paypal_capture_id_unique
  ON public.payments (paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;

INSERT INTO public.system_settings (key, value, updated_at)
VALUES (
  'payment_provider_config',
  jsonb_build_object(
    'paypal_htg_per_usd', 130,
    'paypal_fee_percent', 3.5,
    'paypal_fee_fixed_usd', 0.70
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.system_settings.value, '{}'::jsonb) || jsonb_build_object(
      'paypal_htg_per_usd', COALESCE(public.system_settings.value->'paypal_htg_per_usd', '130'::jsonb),
      'paypal_fee_percent', COALESCE(public.system_settings.value->'paypal_fee_percent', '3.5'::jsonb),
      'paypal_fee_fixed_usd', COALESCE(public.system_settings.value->'paypal_fee_fixed_usd', '0.70'::jsonb)
    ),
    updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_payment_success()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'succeeded' AND NEW.status = 'succeeded' THEN
    IF NEW.net_amount_usd IS NOT NULL THEN
      IF NEW.net_amount_usd < 0 THEN
        RAISE EXCEPTION 'net_amount_usd cannot be negative';
      END IF;

      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) + NEW.net_amount_usd,
            updated_at = now()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance_usd = COALESCE(available_balance_usd, 0) + NEW.net_amount_usd,
            updated_at = now()
        WHERE id = NEW.merchant_id;
      END IF;
    ELSE
      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_test = COALESCE(available_balance_test, 0) + COALESCE(NEW.net_amount, NEW.amount, 0),
            updated_at = now()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance = COALESCE(available_balance, 0) + COALESCE(NEW.net_amount, NEW.amount, 0),
            updated_at = now()
        WHERE id = NEW.merchant_id;
      END IF;
    END IF;
  ELSIF OLD.status = 'succeeded' AND NEW.status = 'refunded' THEN
    IF OLD.net_amount_usd IS NOT NULL THEN
      IF OLD.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) - OLD.net_amount_usd,
            updated_at = now()
        WHERE id = OLD.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance_usd = COALESCE(available_balance_usd, 0) - OLD.net_amount_usd,
            updated_at = now()
        WHERE id = OLD.merchant_id;
      END IF;
    ELSE
      IF OLD.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_test = COALESCE(available_balance_test, 0) - COALESCE(OLD.net_amount, OLD.amount, 0),
            updated_at = now()
        WHERE id = OLD.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance = COALESCE(available_balance, 0) - COALESCE(OLD.net_amount, OLD.amount, 0),
            updated_at = now()
        WHERE id = OLD.merchant_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_success() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_payment_success ON public.payments;
CREATE TRIGGER on_payment_success
AFTER UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_payment_success();
