-- Local proceeds mature at the earlier of twelve elapsed hours or 08:00 on
-- the following calendar day in Haiti. Eligibility remains derived from the
-- database clock, so no browser session or frontend process is involved.

CREATE OR REPLACE FUNCTION public.calculate_local_funds_withdrawable_at(
  p_credited_at TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT LEAST(
    p_credited_at + INTERVAL '12 hours',
    (
      date_trunc('day', p_credited_at AT TIME ZONE 'America/Port-au-Prince')
      + INTERVAL '1 day 8 hours'
    ) AT TIME ZONE 'America/Port-au-Prince'
  );
$$;

REVOKE ALL ON FUNCTION public.calculate_local_funds_withdrawable_at(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_local_funds_withdrawable_at(TIMESTAMPTZ)
  TO service_role;

DO $$
BEGIN
  IF public.calculate_local_funds_withdrawable_at(
    '2026-09-04 07:00:00 America/Port-au-Prince'::TIMESTAMPTZ
  ) <> '2026-09-04 19:00:00 America/Port-au-Prince'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'local_funds_release_policy_failed_for_morning_credit';
  END IF;

  IF public.calculate_local_funds_withdrawable_at(
    '2026-09-04 23:00:00 America/Port-au-Prince'::TIMESTAMPTZ
  ) <> '2026-09-05 08:00:00 America/Port-au-Prince'::TIMESTAMPTZ THEN
    RAISE EXCEPTION 'local_funds_release_policy_failed_for_late_credit';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_local_funds_release_policy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_method TEXT;
  v_provider TEXT;
BEGIN
  IF NEW.currency <> 'HTG' THEN
    RETURN NEW;
  END IF;

  SELECT
    LOWER(COALESCE(NULLIF(p.payment_source, ''), p.payment_method, '')),
    LOWER(COALESCE(p.provider, ''))
  INTO v_method, v_provider
  FROM public.payments p
  WHERE p.id = NEW.payment_id;

  IF v_provider IN ('moncash', 'natcash', 'paym', 'bazik', 'sms_gateway')
     OR v_method IN ('moncash', 'moncash_ussd', 'natcash') THEN
    NEW.withdrawable_at := public.calculate_local_funds_withdrawable_at(NEW.credited_at);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_local_funds_release_policy()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_local_funds_release_policy()
  TO service_role;

DROP TRIGGER IF EXISTS apply_local_funds_release_policy
  ON public.payment_balance_entries;
CREATE TRIGGER apply_local_funds_release_policy
BEFORE INSERT OR UPDATE OF payment_id, credited_at, currency, withdrawable_at
ON public.payment_balance_entries
FOR EACH ROW
EXECUTE FUNCTION public.apply_local_funds_release_policy();

-- Recalculate only local credits that were held by the previous policy.
UPDATE public.payment_balance_entries e
SET withdrawable_at = public.calculate_local_funds_withdrawable_at(e.credited_at)
FROM public.payments p
WHERE p.id = e.payment_id
  AND e.currency = 'HTG'
  AND e.reversed_at IS NULL
  AND e.withdrawable_at > e.credited_at
  AND (
    LOWER(COALESCE(p.provider, '')) IN ('moncash', 'natcash', 'paym', 'bazik', 'sms_gateway')
    OR LOWER(COALESCE(NULLIF(p.payment_source, ''), p.payment_method, '')) IN ('moncash', 'moncash_ussd', 'natcash')
  );

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

  SELECT COALESCE(SUM(e.amount), 0), MIN(e.withdrawable_at)
  INTO v_raw_held, v_next_release
  FROM public.payment_balance_entries e
  WHERE e.merchant_id = p_merchant_id
    AND e.environment = v_environment
    AND e.currency = v_currency
    AND e.reversed_at IS NULL
    AND e.withdrawable_at > NOW();

  v_total := GREATEST(COALESCE(v_total, 0), 0);
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
    'hold_hours', CASE WHEN v_currency = 'HTG' THEN 12 ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT)
  TO service_role;
