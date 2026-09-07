BEGIN;

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

CREATE OR REPLACE FUNCTION public.get_monthly_billable_payment_count(
  p_merchant_id UUID,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.payments AS payment
  WHERE payment.merchant_id = p_merchant_id
    AND payment.environment = 'live'
    AND payment.created_at >= DATE_TRUNC('month', p_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    AND payment.created_at < (DATE_TRUNC('month', p_at AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC'
    AND LOWER(COALESCE(payment.provider, '')) <> 'b2b'
    AND LOWER(COALESCE(payment.payment_source, '')) <> 'b2b'
    AND LOWER(COALESCE(payment.metadata->>'internal_transfer', 'false')) <> 'true'
    AND LOWER(COALESCE(payment.metadata->>'is_subscription_upgrade', 'false')) <> 'true';
$$;

CREATE OR REPLACE FUNCTION public.get_daily_plan_withdrawal_total(
  p_merchant_id UUID,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      DATE_TRUNC('day', p_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS starts_at,
      (DATE_TRUNC('day', p_at AT TIME ZONE 'UTC') + INTERVAL '1 day') AT TIME ZONE 'UTC' AS ends_at
  ), withdrawal_total AS (
    SELECT COALESCE(SUM(
      COALESCE(withdrawal.total, withdrawal.amount, 0)
      * CASE
          WHEN UPPER(COALESCE(withdrawal.currency, 'HTG')) = 'USD'
            THEN COALESCE(NULLIF(withdrawal.exchange_rate, 0), 130)
          ELSE 1
        END
    ), 0) AS amount
    FROM public.withdrawals AS withdrawal
    CROSS JOIN bounds
    WHERE withdrawal.merchant_id = p_merchant_id
      AND COALESCE(withdrawal.environment, 'live') = 'live'
      AND withdrawal.created_at >= bounds.starts_at
      AND withdrawal.created_at < bounds.ends_at
      AND withdrawal.status NOT IN ('failed', 'rejected', 'cancelled')
      AND LOWER(COALESCE(withdrawal.provider, '')) <> 'system_subscription'
  ), legacy_b2b_total AS (
    SELECT COALESCE(SUM(transfer.amount), 0) AS amount
    FROM public.b2b_transfers AS transfer
    CROSS JOIN bounds
    WHERE transfer.sender_id = p_merchant_id
      AND transfer.environment = 'live'
      AND transfer.status = 'completed'
      AND transfer.withdrawal_id IS NULL
      AND transfer.created_at >= bounds.starts_at
      AND transfer.created_at < bounds.ends_at
  )
  SELECT withdrawal_total.amount + legacy_b2b_total.amount
  FROM withdrawal_total, legacy_b2b_total;
$$;

CREATE OR REPLACE FUNCTION public.enforce_payment_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
  v_at TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
  IF COALESCE(NEW.environment, 'live') <> 'live'
     OR LOWER(COALESCE(NEW.provider, '')) = 'b2b'
     OR LOWER(COALESCE(NEW.payment_source, '')) = 'b2b'
     OR LOWER(COALESCE(NEW.metadata->>'internal_transfer', 'false')) = 'true'
     OR LOWER(COALESCE(NEW.metadata->>'is_subscription_upgrade', 'false')) = 'true' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('payment-plan-limit:' || NEW.merchant_id::TEXT || ':' || TO_CHAR(v_at AT TIME ZONE 'UTC', 'YYYY-MM'), 0)
  );

  SELECT limits.monthly_payment_limit INTO v_limit
  FROM public.get_effective_plan_limits(NEW.merchant_id) AS limits;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'plan_limits_unavailable';
  END IF;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  v_used := public.get_monthly_billable_payment_count(NEW.merchant_id, v_at);
  IF v_used >= v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = FORMAT('payment_limit_reached:%s:%s', v_limit, v_used);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_payment_plan_limit_on_insert ON public.payments;
CREATE TRIGGER enforce_payment_plan_limit_on_insert
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_payment_plan_limit();

CREATE OR REPLACE FUNCTION public.enforce_api_key_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  IF COALESCE(NEW.environment, 'live') <> 'live' THEN RETURN NEW; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('api-key-plan-limit:' || NEW.merchant_id::TEXT, 0)
  );

  SELECT limits.api_keys_limit INTO v_limit
  FROM public.get_effective_plan_limits(NEW.merchant_id) AS limits;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'plan_limits_unavailable';
  END IF;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*)::INTEGER INTO v_used
  FROM public.api_keys
  WHERE merchant_id = NEW.merchant_id AND environment = 'live';

  IF v_used >= v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = FORMAT('api_key_limit_reached:%s:%s', v_limit, v_used);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_api_key_plan_limit_on_insert ON public.api_keys;
CREATE TRIGGER enforce_api_key_plan_limit_on_insert
BEFORE INSERT ON public.api_keys
FOR EACH ROW EXECUTE FUNCTION public.enforce_api_key_plan_limit();

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_plan_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_limit NUMERIC;
  v_used NUMERIC;
  v_requested NUMERIC;
  v_at TIMESTAMPTZ := COALESCE(NEW.created_at, NOW());
BEGIN
  IF COALESCE(NEW.environment, 'live') <> 'live'
     OR LOWER(COALESCE(NEW.provider, '')) = 'system_subscription' THEN
    RETURN NEW;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('withdrawal-plan-limit:' || NEW.merchant_id::TEXT || ':' || TO_CHAR(v_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 0)
  );

  SELECT limits.daily_withdrawal_limit INTO v_limit
  FROM public.get_effective_plan_limits(NEW.merchant_id) AS limits;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'plan_limits_unavailable';
  END IF;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

  v_used := public.get_daily_plan_withdrawal_total(NEW.merchant_id, v_at);
  v_requested := COALESCE(NEW.total, NEW.amount, 0)
    * CASE
        WHEN UPPER(COALESCE(NEW.currency, 'HTG')) = 'USD'
          THEN COALESCE(NULLIF(NEW.exchange_rate, 0), 130)
        ELSE 1
      END;

  IF v_used + v_requested > v_limit THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = FORMAT('withdrawal_limit_reached:%s:%s:%s', v_limit, v_used, v_requested);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_withdrawal_plan_limit_on_insert ON public.withdrawals;
CREATE TRIGGER enforce_withdrawal_plan_limit_on_insert
BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_plan_limit();

REVOKE ALL ON FUNCTION public.get_effective_plan_limits(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_monthly_billable_payment_count(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_daily_plan_withdrawal_total(UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_payment_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_api_key_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_withdrawal_plan_limit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_plan_limits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_monthly_billable_payment_count(UUID, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_daily_plan_withdrawal_total(UUID, TIMESTAMPTZ) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
