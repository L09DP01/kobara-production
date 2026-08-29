-- Repairs every subscription whose paid period and grace period are over.
-- Solvent auto-renew subscriptions are renewed first; all remaining accounts
-- are downgraded only when no other valid paid subscription exists.
CREATE OR REPLACE FUNCTION public.reconcile_expired_subscriptions(p_merchant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subscription RECORD;
  v_merchant RECORD;
  v_renewed BOOLEAN;
  v_renewed_count INTEGER := 0;
  v_expired_count INTEGER := 0;
  v_downgraded_count INTEGER := 0;
  v_restored_count INTEGER := 0;
BEGIN
  -- Honor automatic renewal before removing paid access.
  FOR v_subscription IN
    SELECT subscription.id
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE subscription.status = 'active'
      AND subscription.auto_renew = TRUE
      AND (p_merchant_id IS NULL OR subscription.merchant_id = p_merchant_id)
      AND plan.slug <> 'free'
      AND COALESCE(plan.price_htg, 0) > 0
      AND subscription.current_period_end IS NOT NULL
      AND subscription.current_period_end <= NOW()
      AND COALESCE(subscription.grace_period_end, '-infinity'::TIMESTAMPTZ) <= NOW()
    ORDER BY subscription.current_period_end NULLS FIRST
  LOOP
    v_renewed := public.renew_subscription_from_balance(v_subscription.id);
    IF v_renewed THEN
      v_renewed_count := v_renewed_count + 1;
    END IF;
  END LOOP;

  -- Expire paid rows that are no longer entitled after renewal attempts.
  FOR v_subscription IN
    SELECT subscription.id, subscription.merchant_id, subscription.metadata,
           subscription.current_period_end, plan.slug AS plan_slug, plan.name AS plan_name
    FROM public.subscriptions AS subscription
    JOIN public.plans AS plan ON plan.id = subscription.plan_id
    WHERE subscription.status = 'active'
      AND (p_merchant_id IS NULL OR subscription.merchant_id = p_merchant_id)
      AND plan.slug <> 'free'
      AND COALESCE(plan.price_htg, 0) > 0
      AND (
        subscription.current_period_end IS NULL
        OR (
          subscription.current_period_end <= NOW()
          AND COALESCE(subscription.grace_period_end, '-infinity'::TIMESTAMPTZ) <= NOW()
        )
      )
    FOR UPDATE OF subscription
  LOOP
    UPDATE public.subscriptions
    SET status = 'expired',
        metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
          'expired_plan_slug', v_subscription.plan_slug,
          'auto_downgraded_at', NOW()
        ),
        updated_at = NOW()
    WHERE id = v_subscription.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  -- Restore paid access when a valid subscription exists but the denormalized
  -- merchant plan was not updated after a previous interrupted activation.
  FOR v_merchant IN
    SELECT merchant.id, active_plan.plan_slug
    FROM public.merchants AS merchant
    JOIN LATERAL (
      SELECT plan.slug AS plan_slug
      FROM public.subscriptions AS subscription
      JOIN public.plans AS plan ON plan.id = subscription.plan_id
      WHERE subscription.merchant_id = merchant.id
        AND subscription.status = 'active'
        AND (
          subscription.payment_status = 'paid'
          OR (
            subscription.payment_status = 'not_required'
            AND subscription.activation_source IN ('promo', 'admin')
          )
        )
        AND plan.slug <> 'free'
        AND COALESCE(plan.price_htg, 0) > 0
        AND (
          subscription.current_period_end > NOW()
          OR subscription.grace_period_end > NOW()
        )
      ORDER BY COALESCE(subscription.grace_period_end, subscription.current_period_end) DESC
      LIMIT 1
    ) AS active_plan ON TRUE
    WHERE (p_merchant_id IS NULL OR merchant.id = p_merchant_id)
      AND (
        merchant.plan_slug IS DISTINCT FROM active_plan.plan_slug
        OR merchant.plan_status IS DISTINCT FROM 'active'
        OR merchant.account_access IS DISTINCT FROM 'live'
      )
    FOR UPDATE OF merchant
  LOOP
    UPDATE public.merchants
    SET plan_slug = v_merchant.plan_slug,
        plan_status = 'active',
        account_access = 'live',
        updated_at = NOW()
    WHERE id = v_merchant.id;
    v_restored_count := v_restored_count + 1;
  END LOOP;

  -- Downgrade stale merchant rows while preserving subscription history so the
  -- merchant can later reactivate the same plan or choose any other plan.
  FOR v_merchant IN
    SELECT merchant.id, merchant.email, merchant.plan_slug AS previous_plan_slug,
           previous_subscription.id AS subscription_id,
           previous_subscription.plan_name,
           previous_subscription.current_period_end
    FROM public.merchants AS merchant
    LEFT JOIN LATERAL (
      SELECT subscription.id, subscription.current_period_end, plan.name AS plan_name
      FROM public.subscriptions AS subscription
      JOIN public.plans AS plan ON plan.id = subscription.plan_id
      WHERE subscription.merchant_id = merchant.id
        AND plan.slug <> 'free'
        AND COALESCE(plan.price_htg, 0) > 0
      ORDER BY subscription.created_at DESC
      LIMIT 1
    ) AS previous_subscription ON TRUE
    WHERE merchant.plan_slug NOT IN ('free', 'test_only')
      AND (p_merchant_id IS NULL OR merchant.id = p_merchant_id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.subscriptions AS subscription
        JOIN public.plans AS plan ON plan.id = subscription.plan_id
        WHERE subscription.merchant_id = merchant.id
          AND subscription.status = 'active'
          AND (
            subscription.payment_status IN ('paid', 'legacy_confirmed')
            OR (
              subscription.payment_status = 'not_required'
              AND subscription.activation_source IN ('promo', 'admin')
            )
          )
          AND plan.slug <> 'free'
          AND COALESCE(plan.price_htg, 0) > 0
          AND (
            subscription.current_period_end > NOW()
            OR subscription.grace_period_end > NOW()
          )
      )
    FOR UPDATE OF merchant
  LOOP
    UPDATE public.merchants
    SET plan_slug = 'free',
        plan_status = 'active',
        account_access = 'limited_live',
        updated_at = NOW()
    WHERE id = v_merchant.id;

    INSERT INTO public.notifications (merchant_id, type, title, message, resource_id)
    VALUES (
      v_merchant.id,
      'subscription_expired',
      'Plan expiré - compte passé au plan gratuit',
      'Votre abonnement ' || COALESCE(v_merchant.plan_name, v_merchant.previous_plan_slug)
        || ' est arrivé à expiration. Vous pouvez le réactiver ou choisir un autre plan avec le moyen de paiement disponible de votre choix.',
      'subscription_auto_downgrade_' || COALESCE(v_merchant.subscription_id::TEXT, v_merchant.id::TEXT)
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.audit_logs (merchant_id, action, entity_type, entity_id, metadata)
    SELECT
      v_merchant.id,
      'plan.auto_downgraded_free',
      'subscriptions',
      v_merchant.subscription_id,
      jsonb_build_object(
        'previous_plan', v_merchant.previous_plan_slug,
        'subscription_id', v_merchant.subscription_id,
        'current_period_end', v_merchant.current_period_end
      )
    WHERE NOT EXISTS (
      SELECT 1 FROM public.audit_logs
      WHERE merchant_id = v_merchant.id
        AND action = 'plan.auto_downgraded_free'
        AND metadata->>'subscription_id' = COALESCE(v_merchant.subscription_id::TEXT, '')
    );

    v_downgraded_count := v_downgraded_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'renewed', v_renewed_count,
    'expired', v_expired_count,
    'downgraded', v_downgraded_count,
    'restored', v_restored_count
  );
END;
$$;

-- Consumes a coupon and activates the plan in one database transaction.
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription_with_promo(
  p_merchant_id UUID,
  p_plan_id UUID,
  p_billing_cycle TEXT,
  p_amount_htg NUMERIC,
  p_payment_status TEXT,
  p_payment_id UUID,
  p_activation_source TEXT,
  p_promo_code_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_subscription_id UUID;
  v_base_amount NUMERIC;
  v_expected_amount NUMERIC;
  v_is_provider_payment BOOLEAN := p_payment_id IS NOT NULL;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes WHERE id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'promo_not_found'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;

  IF v_promo.plan_id IS NOT NULL AND v_promo.plan_id <> p_plan_id THEN RAISE EXCEPTION 'promo_plan_mismatch'; END IF;
  IF v_promo.merchant_id IS NOT NULL AND v_promo.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'promo_merchant_mismatch'; END IF;

  IF v_is_provider_payment THEN
    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.merchant_id <> p_merchant_id OR v_payment.status <> 'succeeded' THEN
      RAISE EXCEPTION 'payment_not_confirmed';
    END IF;
    -- The server validated the coupon when this payment intent was created.
    IF v_payment.metadata->>'promo_code_id' IS DISTINCT FROM p_promo_code_id::TEXT THEN
      RAISE EXCEPTION 'payment_promo_mismatch';
    END IF;
  ELSE
    IF v_promo.is_active IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'promo_inactive'; END IF;
    IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= NOW() THEN RAISE EXCEPTION 'promo_expired'; END IF;
    IF v_promo.max_uses IS NOT NULL AND COALESCE(v_promo.current_uses, 0) >= v_promo.max_uses THEN
      RAISE EXCEPTION 'promo_limit_reached';
    END IF;
  END IF;

  v_base_amount := CASE
    WHEN p_billing_cycle = 'yearly' THEN ROUND(COALESCE(v_plan.price_htg, 0) * 0.8 * 12, 2)
    ELSE COALESCE(v_plan.price_htg, 0)
  END;
  IF v_is_provider_payment THEN
    v_expected_amount := COALESCE((v_payment.metadata->>'expected_amount')::NUMERIC, v_payment.amount);
    IF ABS(COALESCE(v_payment.amount, 0) - COALESCE(p_amount_htg, 0)) > 0.01 THEN
      RAISE EXCEPTION 'payment_amount_mismatch';
    END IF;
  ELSE
    IF p_billing_cycle = 'yearly' AND v_promo.is_cumulable IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'promo_yearly_not_allowed';
    END IF;
    v_expected_amount := ROUND(v_base_amount * (1 - COALESCE(v_promo.discount_percentage, 0) / 100), 2);
  END IF;
  IF ABS(v_expected_amount - COALESCE(p_amount_htg, 0)) > 0.01 THEN RAISE EXCEPTION 'promo_amount_mismatch'; END IF;
  IF p_payment_status = 'not_required' AND v_expected_amount > 0 THEN RAISE EXCEPTION 'payment_required'; END IF;

  UPDATE public.promo_codes
  SET current_uses = COALESCE(current_uses, 0) + 1, updated_at = NOW()
  WHERE id = p_promo_code_id;

  v_subscription_id := public.activate_merchant_subscription(
    p_merchant_id,
    p_plan_id,
    p_billing_cycle,
    p_amount_htg,
    p_payment_status,
    p_payment_id,
    p_activation_source
  );

  UPDATE public.subscriptions
  SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('promo_code_id', p_promo_code_id)
  WHERE id = v_subscription_id;

  RETURN v_subscription_id;
END;
$$;

-- Balance purchases with a coupon debit, consume and activate atomically.
CREATE OR REPLACE FUNCTION public.purchase_subscription_from_balance_with_promo(
  p_merchant_id UUID,
  p_plan_id UUID,
  p_billing_cycle TEXT,
  p_amount_htg NUMERIC,
  p_promo_code_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_promo public.promo_codes%ROWTYPE;
  v_plan public.plans%ROWTYPE;
  v_base_amount NUMERIC;
  v_expected_amount NUMERIC;
  v_subscription_id UUID;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes WHERE id = p_promo_code_id FOR UPDATE;
  IF NOT FOUND OR v_promo.is_active IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'promo_invalid'; END IF;
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at <= NOW() THEN RAISE EXCEPTION 'promo_expired'; END IF;
  IF v_promo.max_uses IS NOT NULL AND COALESCE(v_promo.current_uses, 0) >= v_promo.max_uses THEN RAISE EXCEPTION 'promo_limit_reached'; END IF;
  IF v_promo.plan_id IS NOT NULL AND v_promo.plan_id <> p_plan_id THEN RAISE EXCEPTION 'promo_plan_mismatch'; END IF;
  IF v_promo.merchant_id IS NOT NULL AND v_promo.merchant_id <> p_merchant_id THEN RAISE EXCEPTION 'promo_merchant_mismatch'; END IF;
  IF p_billing_cycle = 'yearly' AND v_promo.is_cumulable IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'promo_yearly_not_allowed'; END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = p_plan_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'plan_not_found'; END IF;
  v_base_amount := CASE WHEN p_billing_cycle = 'yearly' THEN ROUND(v_plan.price_htg * 0.8 * 12, 2) ELSE v_plan.price_htg END;
  v_expected_amount := ROUND(v_base_amount * (1 - COALESCE(v_promo.discount_percentage, 0) / 100), 2);
  IF ABS(v_expected_amount - p_amount_htg) > 0.01 OR p_amount_htg <= 0 THEN RAISE EXCEPTION 'promo_amount_mismatch'; END IF;

  UPDATE public.promo_codes SET current_uses = COALESCE(current_uses, 0) + 1, updated_at = NOW()
  WHERE id = p_promo_code_id;

  v_subscription_id := public.purchase_subscription_from_balance(
    p_merchant_id, p_plan_id, p_billing_cycle, p_amount_htg, 'balance'
  );
  UPDATE public.subscriptions
  SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object('promo_code_id', p_promo_code_id)
  WHERE id = v_subscription_id;
  RETURN v_subscription_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_expired_subscriptions(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_merchant_subscription_with_promo(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.purchase_subscription_from_balance_with_promo(UUID, UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_merchant_subscription_with_promo(UUID, UUID, TEXT, NUMERIC, TEXT, UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.purchase_subscription_from_balance_with_promo(UUID, UUID, TEXT, NUMERIC, UUID) TO service_role;

-- Immediate, idempotent repair when this script is executed remotely.
SELECT public.reconcile_expired_subscriptions(NULL);

NOTIFY pgrst, 'reload schema';
