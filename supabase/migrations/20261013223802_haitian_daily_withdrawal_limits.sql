BEGIN;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE public.withdrawals ALTER COLUMN request_source SET DEFAULT 'api';
COMMENT ON COLUMN public.withdrawals.request_source IS 'Trusted server origin; legacy requests cannot reliably be attributed to a channel.';

CREATE OR REPLACE FUNCTION public.get_effective_plan_limits(p_merchant_id UUID)
RETURNS TABLE (
  plan_slug TEXT,
  monthly_payment_limit INTEGER,
  api_keys_limit INTEGER,
  daily_withdrawal_limit NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH entitled_paid AS (
    SELECT
      plan.slug::TEXT,
      plan.monthly_payment_limit,
      plan.api_keys_limit,
      plan.daily_withdrawal_limit
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE subscription.merchant_id = p_merchant_id
      AND subscription.status = 'active'
      AND plan.status = 'active'
      AND plan.slug <> 'free'
      AND COALESCE(plan.price_htg, 0) > 0
      AND (
        subscription.payment_status IN ('paid', 'legacy_confirmed')
        OR (
          subscription.payment_status = 'not_required'
          AND subscription.activation_source IN ('promo', 'admin')
        )
      )
      AND (
        subscription.current_period_end > NOW()
        OR subscription.grace_period_end > NOW()
      )
    ORDER BY subscription.created_at DESC
    LIMIT 1
  ), effective AS (
    SELECT * FROM entitled_paid
    UNION ALL
    SELECT
      plan.slug::TEXT,
      plan.monthly_payment_limit,
      plan.api_keys_limit,
      plan.daily_withdrawal_limit
    FROM public.plans AS plan
    WHERE plan.slug = 'free'
      AND plan.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM entitled_paid)
    LIMIT 1
  )
  SELECT * FROM effective;
$$;

CREATE OR REPLACE FUNCTION public.get_daily_dashboard_withdrawal_total(p_merchant_id UUID, p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS NUMERIC LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT DATE_TRUNC('day', p_at AT TIME ZONE 'America/Port-au-Prince') AT TIME ZONE 'America/Port-au-Prince' AS starts_at,
      (DATE_TRUNC('day', p_at AT TIME ZONE 'America/Port-au-Prince') + INTERVAL '1 day') AT TIME ZONE 'America/Port-au-Prince' AS ends_at
  )
  SELECT COALESCE(SUM(COALESCE(w.total, w.amount, 0) *
    CASE WHEN UPPER(COALESCE(w.currency, 'HTG')) = 'USD' THEN COALESCE(NULLIF(w.exchange_rate, 0), 130) ELSE 1 END), 0)
  FROM public.withdrawals w CROSS JOIN bounds
  WHERE w.merchant_id = p_merchant_id AND COALESCE(w.environment, 'live') = 'live'
    AND w.request_source = 'dashboard'
    AND w.created_at >= bounds.starts_at AND w.created_at < bounds.ends_at
    AND w.status NOT IN ('failed', 'rejected', 'cancelled')
    AND LOWER(COALESCE(w.provider, '')) <> 'system_subscription';
$$;

CREATE INDEX IF NOT EXISTS withdrawals_dashboard_quota_idx ON public.withdrawals (merchant_id, created_at)
  WHERE request_source = 'dashboard' AND environment = 'live';

-- Only this server-only wrapper enforces the dashboard cap; API preparation is unchanged.
CREATE OR REPLACE FUNCTION public.prepare_dashboard_withdrawal(
  p_merchant_id UUID, p_amount NUMERIC, p_fees NUMERIC, p_total NUMERIC,
  p_method TEXT, p_provider TEXT, p_wallet TEXT, p_reference TEXT, p_environment TEXT,
  p_source_currency TEXT, p_payout_currency TEXT, p_exchange_rate NUMERIC, p_payout_amount NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL, p_description TEXT DEFAULT 'Retrait Kobara'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_limit NUMERIC;
  v_used NUMERIC;
  v_requested NUMERIC;
  v_result JSONB;
  v_withdrawal public.withdrawals%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('dashboard-withdrawal-plan-limit:' || p_merchant_id::TEXT, 0));
  -- Idempotent retries must return their original result, even after the quota is exhausted.
  IF NULLIF(BTRIM(p_idempotency_key), '') IS NOT NULL THEN
    SELECT * INTO v_withdrawal FROM public.withdrawals
    WHERE merchant_id = p_merchant_id AND idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'already_exists', true, 'withdrawal', row_to_json(v_withdrawal));
    END IF;
  END IF;
  IF p_environment = 'live' THEN
    SELECT limits.daily_withdrawal_limit INTO v_limit FROM public.get_effective_plan_limits(p_merchant_id) AS limits;
    IF NOT FOUND THEN RAISE EXCEPTION 'plan_limits_unavailable'; END IF;
    v_requested := p_total * CASE WHEN UPPER(p_source_currency) = 'USD' THEN p_exchange_rate ELSE 1 END;
    v_used := public.get_daily_dashboard_withdrawal_total(p_merchant_id);
    IF v_limit IS NOT NULL AND v_used + v_requested > v_limit THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = FORMAT('withdrawal_limit_reached:%s:%s:%s', v_limit, v_used, v_requested);
    END IF;
  END IF;
  v_result := public.prepare_automatic_withdrawal(
    p_merchant_id, p_amount, p_fees, p_total, p_method, p_provider, p_wallet, p_reference,
    p_environment, p_source_currency, p_payout_currency, p_exchange_rate, p_payout_amount, p_idempotency_key, p_description
  );
  IF COALESCE((v_result->>'success')::BOOLEAN, false) AND NOT COALESCE((v_result->>'already_exists')::BOOLEAN, false) THEN
    UPDATE public.withdrawals SET request_source = 'dashboard'
    WHERE id = (v_result->'withdrawal'->>'id')::UUID AND merchant_id = p_merchant_id RETURNING * INTO v_withdrawal;
    IF NOT FOUND THEN RAISE EXCEPTION 'dashboard_withdrawal_origin_missing'; END IF;
    v_result := jsonb_set(v_result, '{withdrawal}', to_jsonb(v_withdrawal));
  END IF;
  RETURN v_result;
END;
$$;

-- An earlier global trigger would incorrectly cap API requests.
DROP TRIGGER IF EXISTS enforce_withdrawal_plan_limit_on_insert ON public.withdrawals;
REVOKE ALL ON FUNCTION public.get_effective_plan_limits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_daily_dashboard_withdrawal_total(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prepare_dashboard_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_plan_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_dashboard_withdrawal_total(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.prepare_dashboard_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;
UPDATE public.plans SET daily_withdrawal_limit = 20000 WHERE slug = 'pro';
DO $$
BEGIN
  IF date_trunc('day', '2026-10-14 03:59:59+00'::timestamptz AT TIME ZONE 'America/Port-au-Prince') <> '2026-10-13'::timestamp
     OR date_trunc('day', '2026-10-14 04:00:00+00'::timestamptz AT TIME ZONE 'America/Port-au-Prince') <> '2026-10-14'::timestamp THEN
    RAISE EXCEPTION 'withdrawal_midnight_validation_failed';
  END IF;
  IF ('2026-03-09 00:00:00'::timestamp AT TIME ZONE 'America/Port-au-Prince') - ('2026-03-08 00:00:00'::timestamp AT TIME ZONE 'America/Port-au-Prince') <> INTERVAL '23 hours'
     OR ('2026-11-02 00:00:00'::timestamp AT TIME ZONE 'America/Port-au-Prince') - ('2026-11-01 00:00:00'::timestamp AT TIME ZONE 'America/Port-au-Prince') <> INTERVAL '25 hours' THEN
    RAISE EXCEPTION 'withdrawal_dst_validation_failed';
  END IF;
END;
$$;
NOTIFY pgrst, 'reload schema';
COMMIT;
