BEGIN;
CREATE TABLE public.merchant_activation_reminders (
  merchant_id UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('kyc', 'first_payment')),
  next_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 days'),
  last_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivery_id UUID NOT NULL DEFAULT gen_random_uuid(),
  lease_token UUID,
  leased_until TIMESTAMPTZ,
  delivery_started_at TIMESTAMPTZ
);
ALTER TABLE public.merchant_activation_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.merchant_activation_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.merchant_activation_reminders TO service_role;
CREATE INDEX activation_reminders_due_idx ON public.merchant_activation_reminders(next_due_at) WHERE completed_at IS NULL;

CREATE OR REPLACE FUNCTION public.merchant_has_first_live_payment(p_merchant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.payments p WHERE p.merchant_id = p_merchant_id
      AND p.environment = 'live' AND p.status IN ('succeeded', 'success', 'completed')
      AND p.amount > 0 AND LOWER(COALESCE(p.provider, '')) NOT IN ('b2b', 'system_subscription')
      AND LOWER(COALESCE(p.payment_source, '')) <> 'b2b'
      AND COALESCE(p.metadata->>'is_subscription_upgrade', 'false') <> 'true'
  );
$$;
CREATE OR REPLACE FUNCTION public.merchant_activation_reminder_kind(p_merchant_id UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT CASE WHEN m.kyc_status = 'approved' THEN 'first_payment' ELSE 'kyc' END
  FROM public.merchants m JOIN public.users u ON u.id = m.user_id
  WHERE m.id = p_merchant_id AND COALESCE(m.email, '') <> '' AND u.is_active = true
    AND u.email_verified = true AND LOWER(m.email) = LOWER(u.email)
    AND COALESCE(m.status, '') NOT IN ('suspended', 'closed', 'inactive', 'rejected')
    AND COALESCE(m.account_access, '') NOT IN ('suspended', 'permanently_closed', 'closure_pending', 'closure_pending_payout')
    AND NOT EXISTS (SELECT 1 FROM public.settings s WHERE s.merchant_id = m.id
      AND s.notifications_json->>'activation_reminders' = 'false')
    AND NOT public.merchant_has_first_live_payment(m.id);
$$;

CREATE OR REPLACE FUNCTION public.claim_merchant_activation_reminders()
RETURNS TABLE(merchant_id UUID, email TEXT, business_name TEXT, kind TEXT, delivery_id UUID, lease_token UUID)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Seed at most 500 accounts per run. Existing accounts start with a 3-day grace period.
  INSERT INTO public.merchant_activation_reminders(merchant_id, kind)
    SELECT m.id, public.merchant_activation_reminder_kind(m.id)
    FROM public.merchants m
    WHERE NOT EXISTS (SELECT 1 FROM public.merchant_activation_reminders r WHERE r.merchant_id = m.id)
      AND public.merchant_activation_reminder_kind(m.id) IS NOT NULL
    ORDER BY m.created_at LIMIT 500 ON CONFLICT DO NOTHING;

  UPDATE public.merchant_activation_reminders r SET completed_at = NOW(), lease_token = NULL, leased_until = NULL
    WHERE r.completed_at IS NULL AND public.merchant_has_first_live_payment(r.merchant_id);

  UPDATE public.merchant_activation_reminders r SET kind = public.merchant_activation_reminder_kind(r.merchant_id),
    next_due_at = NOW() + INTERVAL '3 days', delivery_id = gen_random_uuid(),
    lease_token = NULL, leased_until = NULL, delivery_started_at = NULL
    WHERE r.completed_at IS NULL AND public.merchant_activation_reminder_kind(r.merchant_id) IS NOT NULL
      AND r.kind IS DISTINCT FROM public.merchant_activation_reminder_kind(r.merchant_id)
      AND (r.leased_until IS NULL OR r.leased_until < NOW());

  RETURN QUERY WITH due AS (
    SELECT r.merchant_id FROM public.merchant_activation_reminders r
    WHERE r.completed_at IS NULL AND r.next_due_at <= NOW()
      AND (r.leased_until IS NULL OR r.leased_until < NOW())
      -- Provider idempotency expires after 24h: uncertain older deliveries require review.
      AND (r.delivery_started_at IS NULL OR r.delivery_started_at > NOW() - INTERVAL '23 hours')
      AND r.kind = public.merchant_activation_reminder_kind(r.merchant_id)
    ORDER BY r.next_due_at FOR UPDATE OF r SKIP LOCKED LIMIT 10
  ), claimed AS (
    UPDATE public.merchant_activation_reminders r SET lease_token = gen_random_uuid(),
      leased_until = NOW() + INTERVAL '30 minutes', delivery_started_at = COALESCE(r.delivery_started_at, NOW())
    FROM due WHERE r.merchant_id = due.merchant_id RETURNING r.*
  ) SELECT c.merchant_id, m.email::TEXT, m.business_name::TEXT, c.kind, c.delivery_id, c.lease_token
    FROM claimed c JOIN public.merchants m ON m.id = c.merchant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_merchant_activation_reminder(p_merchant_id UUID, p_lease_token UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.merchant_activation_reminders r
    WHERE r.merchant_id = p_merchant_id AND r.lease_token = p_lease_token AND r.leased_until > NOW()
      AND r.completed_at IS NULL AND r.kind = public.merchant_activation_reminder_kind(r.merchant_id));
$$;

CREATE OR REPLACE FUNCTION public.finish_merchant_activation_reminder(p_merchant_id UUID, p_lease_token UUID, p_sent BOOLEAN)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.merchant_activation_reminders r SET
    last_sent_at = CASE WHEN p_sent THEN NOW() ELSE r.last_sent_at END,
    next_due_at = NOW() + CASE WHEN p_sent THEN INTERVAL '3 days' ELSE INTERVAL '1 hour' END,
    sent_count = r.sent_count + CASE WHEN p_sent THEN 1 ELSE 0 END,
    delivery_id = CASE WHEN p_sent THEN gen_random_uuid() ELSE r.delivery_id END,
    delivery_started_at = CASE WHEN p_sent THEN NULL ELSE r.delivery_started_at END,
    lease_token = NULL, leased_until = NULL
    WHERE r.merchant_id = p_merchant_id AND r.lease_token = p_lease_token;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_has_first_live_payment(UUID), public.merchant_activation_reminder_kind(UUID),
  public.claim_merchant_activation_reminders(), public.validate_merchant_activation_reminder(UUID, UUID),
  public.finish_merchant_activation_reminder(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_has_first_live_payment(UUID), public.merchant_activation_reminder_kind(UUID),
  public.claim_merchant_activation_reminders(), public.validate_merchant_activation_reminder(UUID, UUID),
  public.finish_merchant_activation_reminder(UUID, UUID, BOOLEAN) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
