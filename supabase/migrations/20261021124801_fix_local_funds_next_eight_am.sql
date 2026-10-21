BEGIN;

-- First deadline wins: twelve elapsed hours or the next 08:00 in Haiti.
-- Before 08:00 this is the same morning, not the following calendar day.
CREATE OR REPLACE FUNCTION public.calculate_local_funds_withdrawable_at(p_credited_at TIMESTAMPTZ)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
STRICT
SET search_path = ''
AS $$
  SELECT LEAST(
    p_credited_at + INTERVAL '12 hours',
    (
      date_trunc('day', p_credited_at AT TIME ZONE 'America/Port-au-Prince')
      + CASE
          WHEN (p_credited_at AT TIME ZONE 'America/Port-au-Prince')::time <= TIME '08:00'
            THEN INTERVAL '8 hours'
          ELSE INTERVAL '1 day 8 hours'
        END
    ) AT TIME ZONE 'America/Port-au-Prince'
  );
$$;

REVOKE ALL ON FUNCTION public.calculate_local_funds_withdrawable_at(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_local_funds_withdrawable_at(TIMESTAMPTZ)
  TO service_role;

-- Only shorten existing local holds. Never credit balances or delay funds again.
UPDATE public.payment_balance_entries e
SET withdrawable_at = public.calculate_local_funds_withdrawable_at(e.credited_at)
FROM public.payments p
WHERE p.id = e.payment_id
  AND e.currency = 'HTG'
  AND e.reversed_at IS NULL
  AND e.withdrawable_at > public.calculate_local_funds_withdrawable_at(e.credited_at)
  AND (
    LOWER(COALESCE(p.provider, '')) IN ('moncash', 'natcash', 'paym', 'bazik', 'sms_gateway')
    OR LOWER(COALESCE(NULLIF(p.payment_source, ''), p.payment_method, '')) IN ('moncash', 'moncash_ussd', 'natcash')
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM (VALUES
      ('2026-10-21 00:00 America/Port-au-Prince'::timestamptz, '2026-10-21 08:00 America/Port-au-Prince'::timestamptz),
      ('2026-10-21 07:59 America/Port-au-Prince'::timestamptz, '2026-10-21 08:00 America/Port-au-Prince'::timestamptz),
      ('2026-10-21 08:00 America/Port-au-Prince'::timestamptz, '2026-10-21 08:00 America/Port-au-Prince'::timestamptz),
      ('2026-10-21 08:01 America/Port-au-Prince'::timestamptz, '2026-10-21 20:01 America/Port-au-Prince'::timestamptz),
      ('2026-10-21 19:00 America/Port-au-Prince'::timestamptz, '2026-10-22 07:00 America/Port-au-Prince'::timestamptz),
      ('2026-10-21 23:00 America/Port-au-Prince'::timestamptz, '2026-10-22 08:00 America/Port-au-Prince'::timestamptz),
      ('2026-03-08 00:00 America/Port-au-Prince'::timestamptz, '2026-03-08 08:00 America/Port-au-Prince'::timestamptz),
      ('2026-11-01 00:00 America/Port-au-Prince'::timestamptz, '2026-11-01 08:00 America/Port-au-Prince'::timestamptz)
    ) AS cases(credited_at, expected_at)
    WHERE public.calculate_local_funds_withdrawable_at(credited_at) IS DISTINCT FROM expected_at
  ) THEN
    RAISE EXCEPTION 'local_funds_next_eight_am_policy_failed';
  END IF;
END;
$$;

COMMIT;
