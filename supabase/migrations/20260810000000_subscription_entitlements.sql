-- Subscription entitlement hardening.
-- Paid access is effective only while status is active and the paid period (or an
-- explicitly configured grace period) is still in the future.

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS activation_source VARCHAR(32),
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.subscriptions AS subscription
SET payment_status = CASE
  WHEN plan.slug = 'free' OR plan.price_htg = 0 THEN 'not_required'
  WHEN subscription.status = 'active'
       AND subscription.current_period_end IS NOT NULL THEN 'legacy_confirmed'
  ELSE subscription.payment_status
END
FROM public.plans AS plan
WHERE plan.id = subscription.plan_id
  AND subscription.payment_status = 'unknown';

-- Compensation for the application bug: subscriptions that were still marked
-- active although their paid period had ended receive one explicit five-day
-- grace period starting when this migration is applied.
UPDATE public.subscriptions AS subscription
SET grace_period_end = NOW() + INTERVAL '5 days', updated_at = NOW()
FROM public.plans AS plan
WHERE plan.id = subscription.plan_id
  AND plan.slug <> 'free'
  AND plan.price_htg > 0
  AND subscription.status = 'active'
  AND subscription.current_period_end IS NOT NULL
  AND subscription.current_period_end <= NOW()
  AND subscription.grace_period_end IS NULL;

INSERT INTO public.notifications (merchant_id, type, title, message, resource_id)
SELECT
  subscription.merchant_id,
  'subscription_grace_period',
  'Votre plan a expiré - délai exceptionnel',
  'Votre abonnement a expiré. Kobara vous accorde exceptionnellement cinq jours pour le renouveler.',
  'subscription_compensation_grace_' || subscription.id::TEXT
FROM public.subscriptions AS subscription
JOIN public.plans AS plan ON plan.id = subscription.plan_id
WHERE plan.slug <> 'free'
  AND plan.price_htg > 0
  AND subscription.status = 'active'
  AND subscription.current_period_end <= NOW()
  AND subscription.grace_period_end > NOW()
ON CONFLICT DO NOTHING;

-- Immediate repair for invalid rows and for rows whose explicit grace period
-- is already over. Runtime authorization also enforces this without the cron.
UPDATE public.subscriptions AS subscription
SET status = 'expired', updated_at = NOW()
FROM public.plans AS plan
WHERE plan.id = subscription.plan_id
  AND plan.slug <> 'free'
  AND plan.price_htg > 0
  AND subscription.status = 'active'
  AND (
    subscription.current_period_end IS NULL
    OR (
      subscription.current_period_end <= NOW()
      AND COALESCE(subscription.grace_period_end, '-infinity'::TIMESTAMPTZ) <= NOW()
    )
  );

UPDATE public.merchants AS merchant
SET plan_slug = 'free', plan_status = 'active', account_access = 'limited_live'
WHERE merchant.plan_slug NOT IN ('free', 'test_only')
  AND NOT EXISTS (
    SELECT 1
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE subscription.merchant_id = merchant.id
      AND subscription.status = 'active'
      AND plan.slug <> 'free'
      AND plan.price_htg > 0
      AND (
        subscription.current_period_end > NOW()
        OR subscription.grace_period_end > NOW()
      )
  );

CREATE INDEX IF NOT EXISTS idx_subscriptions_merchant_created
  ON public.subscriptions (merchant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expiration
  ON public.subscriptions (current_period_end)
  WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_payment_id_unique
  ON public.subscriptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.activate_merchant_subscription(
  p_merchant_id UUID,
  p_plan_id UUID,
  p_billing_cycle TEXT,
  p_amount_htg NUMERIC,
  p_payment_status TEXT,
  p_payment_id UUID,
  p_activation_source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan public.plans%ROWTYPE;
  v_subscription_id UUID;
  v_period_end TIMESTAMPTZ;
  v_is_free BOOLEAN;
BEGIN
  PERFORM 1 FROM public.merchants WHERE id = p_merchant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  v_is_free := v_plan.slug = 'free' OR COALESCE(v_plan.price_htg, 0) = 0;
  IF NOT v_is_free
     AND p_payment_status <> 'paid'
     AND NOT (p_activation_source = 'promo' AND p_payment_status = 'not_required') THEN
    RAISE EXCEPTION 'payment_not_confirmed';
  END IF;

  IF p_billing_cycle NOT IN ('monthly', 'yearly') THEN
    RAISE EXCEPTION 'invalid_billing_cycle';
  END IF;

  v_period_end := CASE
    WHEN v_is_free THEN NULL
    WHEN p_billing_cycle = 'yearly' THEN NOW() + INTERVAL '1 year'
    ELSE NOW() + INTERVAL '1 month'
  END;

  UPDATE public.subscriptions
  SET status = 'canceled', cancelled_at = NOW(), updated_at = NOW()
  WHERE merchant_id = p_merchant_id AND status = 'active';

  INSERT INTO public.subscriptions (
    merchant_id,
    plan_id,
    status,
    billing_cycle,
    amount_htg,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    payment_status,
    payment_id,
    activation_source,
    updated_at
  ) VALUES (
    p_merchant_id,
    p_plan_id,
    'active',
    p_billing_cycle,
    GREATEST(COALESCE(p_amount_htg, 0), 0),
    NOW(),
    v_period_end,
    FALSE,
    p_payment_status,
    p_payment_id,
    p_activation_source,
    NOW()
  ) RETURNING id INTO v_subscription_id;

  UPDATE public.merchants
  SET plan_slug = v_plan.slug,
      plan_status = 'active',
      account_access = CASE WHEN v_is_free THEN 'limited_live' ELSE 'live' END
  WHERE id = p_merchant_id;

  INSERT INTO public.audit_logs (merchant_id, action, entity_type, entity_id, metadata)
  VALUES (
    p_merchant_id,
    'plan.activated',
    'subscription',
    v_subscription_id,
    jsonb_build_object(
      'plan_slug', v_plan.slug,
      'billing_cycle', p_billing_cycle,
      'payment_status', p_payment_status,
      'activation_source', p_activation_source
    )
  );

  RETURN v_subscription_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_merchant_subscription(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_plan public.plans%ROWTYPE;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF NOT FOUND OR v_subscription.status <> 'active' THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
  IF v_plan.slug = 'free' OR COALESCE(v_plan.price_htg, 0) = 0 THEN
    RETURN FALSE;
  END IF;

  IF v_subscription.current_period_end > NOW()
     OR v_subscription.grace_period_end > NOW() THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET status = 'expired', updated_at = NOW()
  WHERE id = p_subscription_id;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE subscription.merchant_id = v_subscription.merchant_id
      AND subscription.id <> p_subscription_id
      AND subscription.status = 'active'
      AND plan.slug <> 'free'
      AND plan.price_htg > 0
      AND (
        subscription.current_period_end > NOW()
        OR subscription.grace_period_end > NOW()
      )
  ) THEN
    UPDATE public.merchants
    SET plan_slug = 'free', plan_status = 'active', account_access = 'limited_live'
    WHERE id = v_subscription.merchant_id;
  END IF;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_subscription_from_balance(p_subscription_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_balance NUMERIC;
  v_next_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
  IF v_plan.slug = 'free' OR COALESCE(v_subscription.amount_htg, 0) <= 0 THEN
    RETURN FALSE;
  END IF;

  SELECT available_balance INTO v_balance
  FROM public.merchants
  WHERE id = v_subscription.merchant_id
  FOR UPDATE;

  IF COALESCE(v_balance, 0) < v_subscription.amount_htg THEN
    RETURN FALSE;
  END IF;

  v_next_end := GREATEST(COALESCE(v_subscription.current_period_end, NOW()), NOW())
    + CASE WHEN v_subscription.billing_cycle = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END;

  UPDATE public.merchants
  SET available_balance = available_balance - v_subscription.amount_htg,
      plan_slug = v_plan.slug,
      plan_status = 'active',
      account_access = 'live'
  WHERE id = v_subscription.merchant_id;

  UPDATE public.subscriptions
  SET status = 'active',
      current_period_start = NOW(),
      current_period_end = v_next_end,
      grace_period_end = NULL,
      payment_status = 'paid',
      updated_at = NOW()
  WHERE id = p_subscription_id;

  INSERT INTO public.withdrawals (
    merchant_id, kobara_reference, amount, fees, total, wallet,
    description, status, provider, environment
  ) VALUES (
    v_subscription.merchant_id,
    'SUB_' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8)),
    v_subscription.amount_htg,
    0,
    v_subscription.amount_htg,
    'Kobara Wallet',
    'Renouvellement abonnement ' || v_plan.name,
    'completed',
    'system_subscription',
    'live'
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.purchase_subscription_from_balance(
  p_merchant_id UUID,
  p_plan_id UUID,
  p_billing_cycle TEXT,
  p_amount_htg NUMERIC,
  p_activation_source TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance NUMERIC;
  v_plan public.plans%ROWTYPE;
  v_subscription_id UUID;
  v_reference TEXT;
BEGIN
  IF p_amount_htg <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT available_balance INTO v_balance
  FROM public.merchants
  WHERE id = p_merchant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'merchant_not_found'; END IF;
  IF COALESCE(v_balance, 0) < p_amount_htg THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND OR v_plan.slug = 'free' OR COALESCE(v_plan.price_htg, 0) = 0 THEN
    RAISE EXCEPTION 'invalid_paid_plan';
  END IF;

  UPDATE public.merchants
  SET available_balance = available_balance - p_amount_htg
  WHERE id = p_merchant_id;

  v_subscription_id := public.activate_merchant_subscription(
    p_merchant_id,
    p_plan_id,
    p_billing_cycle,
    p_amount_htg,
    'paid',
    NULL,
    p_activation_source
  );

  v_reference := 'SUB_' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));
  INSERT INTO public.withdrawals (
    merchant_id, kobara_reference, amount, fees, total, wallet,
    description, status, provider, environment
  ) VALUES (
    p_merchant_id,
    v_reference,
    p_amount_htg,
    0,
    p_amount_htg,
    'Kobara Wallet',
    'Achat abonnement ' || v_plan.name,
    'completed',
    'system_subscription',
    'live'
  );

  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_merchant_subscription(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_merchant_subscription(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.renew_subscription_from_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_subscription_from_balance(UUID, UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_merchant_subscription(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.renew_subscription_from_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_subscription_from_balance(UUID, UUID, TEXT, NUMERIC, TEXT) TO service_role;

COMMIT;
