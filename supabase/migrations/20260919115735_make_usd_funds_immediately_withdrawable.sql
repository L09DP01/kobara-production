-- USD proceeds are immediately withdrawable. The local-funds security hold
-- remains restricted to HTG payment rails.

UPDATE public.payment_balance_entries
SET withdrawable_at = credited_at
WHERE currency = 'USD'
  AND withdrawable_at <> credited_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_balance_entries
    WHERE currency = 'USD'
      AND withdrawable_at <> credited_at
  ) THEN
    RAISE EXCEPTION 'usd_funds_must_be_immediately_withdrawable';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.force_usd_funds_immediately_withdrawable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.currency = 'USD' THEN
    NEW.withdrawable_at := NEW.credited_at;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.force_usd_funds_immediately_withdrawable()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.force_usd_funds_immediately_withdrawable()
  TO service_role;

DROP TRIGGER IF EXISTS force_usd_funds_immediately_withdrawable
  ON public.payment_balance_entries;
CREATE TRIGGER force_usd_funds_immediately_withdrawable
BEFORE INSERT OR UPDATE OF credited_at, currency, withdrawable_at
ON public.payment_balance_entries
FOR EACH ROW
EXECUTE FUNCTION public.force_usd_funds_immediately_withdrawable();

CREATE OR REPLACE FUNCTION public.get_merchant_funds_availability(
  p_merchant_id UUID,
  p_environment TEXT DEFAULT 'live',
  p_currency TEXT DEFAULT 'HTG'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_environment TEXT;
  v_currency TEXT;
  v_total NUMERIC(15,2);
  v_raw_held NUMERIC(15,2);
  v_held NUMERIC(15,2);
  v_next_release TIMESTAMPTZ;
BEGIN
  v_environment := CASE WHEN LOWER(BTRIM(COALESCE(p_environment, ''))) = 'test' THEN 'test' ELSE 'live' END;
  v_currency := UPPER(BTRIM(COALESCE(p_currency, '')));

  IF v_currency NOT IN ('HTG', 'USD') THEN
    RAISE EXCEPTION 'unsupported_currency';
  END IF;

  SELECT CASE
    WHEN v_currency = 'USD' AND v_environment = 'test' THEN COALESCE(m.available_balance_usd_test, 0)
    WHEN v_currency = 'USD' THEN COALESCE(m.available_balance_usd, 0)
    WHEN v_environment = 'test' THEN COALESCE(m.available_balance_test, 0)
    ELSE COALESCE(m.available_balance, 0)
  END
  INTO v_total
  FROM public.merchants m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  v_total := GREATEST(COALESCE(v_total, 0), 0);

  IF v_currency = 'USD' THEN
    RETURN jsonb_build_object(
      'currency', v_currency,
      'environment', v_environment,
      'total_balance', v_total,
      'withdrawable_balance', v_total,
      'pending_release_balance', 0,
      'raw_pending_release_balance', 0,
      'next_release_at', NULL::TIMESTAMPTZ,
      'hold_hours', 0
    );
  END IF;

  SELECT COALESCE(SUM(e.amount), 0), MIN(e.withdrawable_at)
  INTO v_raw_held, v_next_release
  FROM public.payment_balance_entries e
  WHERE e.merchant_id = p_merchant_id
    AND e.environment = v_environment
    AND e.currency = 'HTG'
    AND e.reversed_at IS NULL
    AND e.withdrawable_at > NOW();

  v_raw_held := GREATEST(COALESCE(v_raw_held, 0), 0);
  v_held := LEAST(v_total, v_raw_held);

  RETURN jsonb_build_object(
    'currency', v_currency,
    'environment', v_environment,
    'total_balance', v_total,
    'withdrawable_balance', GREATEST(v_total - v_held, 0),
    'pending_release_balance', v_held,
    'raw_pending_release_balance', v_raw_held,
    'next_release_at', v_next_release,
    'hold_hours', 12
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT)
  TO service_role;
