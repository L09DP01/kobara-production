BEGIN;

-- Subscription purchases consume the merchant's aggregate balance. Pending
-- local-payment holds restrict external withdrawals, not internal plan fees.
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
  v_reference TEXT;
BEGIN
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = v_subscription.plan_id;
  IF NOT FOUND OR v_plan.slug = 'free' OR COALESCE(v_subscription.amount_htg, 0) <= 0 THEN
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
  v_reference := 'SUB' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 20));

  UPDATE public.merchants
  SET available_balance = COALESCE(available_balance, 0) - v_subscription.amount_htg,
      plan_slug = v_plan.slug,
      plan_status = 'active',
      account_access = 'live',
      updated_at = NOW()
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
    description, status, provider, environment, currency, payout_currency,
    exchange_rate, payout_amount, balance_reserved_at, provider_response,
    completed_at, created_at, updated_at
  ) VALUES (
    v_subscription.merchant_id,
    v_reference,
    v_subscription.amount_htg,
    0,
    v_subscription.amount_htg,
    'Kobara',
    'Renouvellement abonnement ' || v_plan.name,
    'completed',
    'system_subscription',
    'live',
    'HTG',
    'HTG',
    1,
    v_subscription.amount_htg,
    NULL,
    jsonb_build_object(
      'internal_debit', true,
      'purpose', 'subscription_renewal',
      'subscription_id', p_subscription_id,
      'plan_id', v_plan.id,
      'billing_cycle', v_subscription.billing_cycle
    ),
    NOW(),
    NOW(),
    NOW()
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
  IF COALESCE(p_amount_htg, 0) <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF p_billing_cycle NOT IN ('monthly', 'yearly') THEN RAISE EXCEPTION 'invalid_billing_cycle'; END IF;

  SELECT available_balance INTO v_balance
  FROM public.merchants
  WHERE id = p_merchant_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'merchant_not_found'; END IF;

  -- available_balance is the aggregate account balance. Withdrawal maturity is
  -- intentionally not consulted for an internal subscription purchase.
  IF COALESCE(v_balance, 0) < p_amount_htg THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND OR v_plan.slug = 'free' OR COALESCE(v_plan.price_htg, 0) = 0 THEN
    RAISE EXCEPTION 'invalid_paid_plan';
  END IF;

  UPDATE public.merchants
  SET available_balance = COALESCE(available_balance, 0) - p_amount_htg,
      updated_at = NOW()
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

  v_reference := 'SUB' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 20));
  INSERT INTO public.withdrawals (
    merchant_id, kobara_reference, amount, fees, total, wallet,
    description, status, provider, environment, currency, payout_currency,
    exchange_rate, payout_amount, balance_reserved_at, provider_response,
    completed_at, created_at, updated_at
  ) VALUES (
    p_merchant_id,
    v_reference,
    p_amount_htg,
    0,
    p_amount_htg,
    'Kobara',
    'Achat abonnement ' || v_plan.name,
    'completed',
    'system_subscription',
    'live',
    'HTG',
    'HTG',
    1,
    p_amount_htg,
    NULL,
    jsonb_build_object(
      'internal_debit', true,
      'purpose', 'subscription_purchase',
      'subscription_id', v_subscription_id,
      'plan_id', v_plan.id,
      'billing_cycle', p_billing_cycle,
      'activation_source', p_activation_source
    ),
    NOW(),
    NOW(),
    NOW()
  );

  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_subscription_from_balance(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_subscription_from_balance(UUID, UUID, TEXT, NUMERIC, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.renew_subscription_from_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_subscription_from_balance(UUID, UUID, TEXT, NUMERIC, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
