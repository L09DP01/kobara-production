-- Fix: legacy_confirmed protects plan during grace but does NOT restore.
--
-- Rules:
--   RESTORE section: only 'paid' or promo/admin can re-upgrade a merchant
--   DOWNGRADE section: 'legacy_confirmed' STILL protects the plan while
--                      current_period_end or grace_period_end is in the future

-- Step 1: Update the reconcile function with correct logic
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

  -- RESTORE: Only 'paid' or promo/admin can re-upgrade a downgraded merchant.
  -- legacy_confirmed is EXCLUDED — it should never trigger a re-upgrade.
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

  -- DOWNGRADE: Remove paid access only when NO active subscription protects it.
  -- legacy_confirmed IS included here — it still protects the plan during grace.
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
            -- paid, legacy_confirmed, or promo/admin all protect the plan
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

-- Step 2: Restore the 2 merchants whose grace is still active.
-- They were incorrectly downgraded. Restore them to their plan during grace.
UPDATE public.merchants AS merchant
SET plan_slug = plan_info.plan_slug,
    plan_status = 'active',
    account_access = 'live',
    updated_at = NOW()
FROM (
  SELECT DISTINCT ON (subscription.merchant_id)
    subscription.merchant_id,
    plan.slug AS plan_slug
  FROM public.subscriptions AS subscription
  JOIN public.plans AS plan ON plan.id = subscription.plan_id
  WHERE subscription.status = 'active'
    AND subscription.payment_status = 'legacy_confirmed'
    AND plan.slug <> 'free'
    AND COALESCE(plan.price_htg, 0) > 0
    AND (
      subscription.current_period_end > NOW()
      OR subscription.grace_period_end > NOW()
    )
  ORDER BY subscription.merchant_id, COALESCE(subscription.grace_period_end, subscription.current_period_end) DESC
) AS plan_info
WHERE merchant.id = plan_info.merchant_id;

-- Step 3: Permissions
REVOKE ALL ON FUNCTION public.reconcile_expired_subscriptions(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_expired_subscriptions(UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
