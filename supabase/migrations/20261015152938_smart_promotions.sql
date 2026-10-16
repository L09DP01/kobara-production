BEGIN;
CREATE TABLE public.smart_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL CHECK(segment IN ('links_no_payment','api_not_started','inactive30')),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 160),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000),
  sources JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','approved','paused','completed')),
  created_by UUID NOT NULL, approved_by UUID, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.smart_promotion_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), campaign_id UUID NOT NULL REFERENCES public.smart_promotions(id),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id), email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed')),
  sent_at TIMESTAMPTZ, started_at TIMESTAMPTZ, leased_until TIMESTAMPTZ, lease_token UUID,
  UNIQUE(campaign_id,email)
);
CREATE INDEX smart_promotion_queue_idx ON public.smart_promotion_recipients(campaign_id,status);
CREATE INDEX smart_promotion_cooldown_idx ON public.smart_promotion_recipients(lower(email),sent_at);
CREATE TABLE public.promotion_suppressions(email TEXT PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
ALTER TABLE public.smart_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_promotion_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_suppressions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.smart_promotions, public.smart_promotion_recipients, public.promotion_suppressions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.smart_promotions, public.smart_promotion_recipients, public.promotion_suppressions TO service_role;

CREATE OR REPLACE FUNCTION public.smart_promotion_segment(p_id UUID,p_segment TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT CASE p_segment
    WHEN 'links_no_payment' THEN NOT public.merchant_has_first_live_payment(p_id) AND EXISTS(
      SELECT 1 FROM public.payment_links l WHERE l.merchant_id=p_id AND l.environment='live' AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>NOW()))
    WHEN 'api_not_started' THEN EXISTS(SELECT 1 FROM public.api_keys k WHERE k.merchant_id=p_id AND k.environment='live' AND k.revoked_at IS NULL)
      AND NOT EXISTS(SELECT 1 FROM public.payments p WHERE p.merchant_id=p_id AND p.environment='live' AND p.status IN ('succeeded','success','completed') AND p.api_key_id IS NOT NULL AND COALESCE(p.metadata->>'is_subscription_upgrade','false')<>'true' AND COALESCE(p.provider,'')<>'b2b')
    WHEN 'inactive30' THEN public.merchant_has_first_live_payment(p_id) AND NOT EXISTS(
      SELECT 1 FROM public.payments p WHERE p.merchant_id=p_id AND p.environment='live' AND p.status IN ('succeeded','success','completed')
        AND COALESCE(p.paid_at,p.created_at)>NOW()-INTERVAL '30 days' AND COALESCE(p.provider,'') NOT IN ('b2b','system_subscription') AND COALESCE(p.metadata->>'is_subscription_upgrade','false')<>'true')
    ELSE false END;
$$;
CREATE OR REPLACE FUNCTION public.smart_promotion_eligible(p_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.merchants m JOIN public.users u ON u.id=m.user_id
    WHERE m.id=p_id AND m.kyc_status='approved' AND u.is_active=true AND u.email_verified=true AND lower(m.email)=lower(u.email)
      AND COALESCE(m.status,'') NOT IN ('suspended','closed','inactive','rejected')
      AND COALESCE(m.account_access,'') NOT IN ('suspended','permanently_closed','closure_pending','closure_pending_payout')
      AND EXISTS(SELECT 1 FROM public.settings s WHERE s.merchant_id=m.id AND s.notifications_json->>'marketing_promotions'='true')
      AND NOT EXISTS(SELECT 1 FROM public.promotion_suppressions x WHERE x.email=lower(m.email))
      AND NOT EXISTS(SELECT 1 FROM public.support_tickets t WHERE t.merchant_id=m.id AND t.status<>'closed')
      AND NOT EXISTS(SELECT 1 FROM public.merchant_activation_reminders a WHERE a.merchant_id=m.id AND a.last_sent_at >= date_trunc('day',NOW() AT TIME ZONE 'America/Port-au-Prince') AT TIME ZONE 'America/Port-au-Prince')
      AND NOT EXISTS(SELECT 1 FROM public.smart_promotion_recipients r WHERE lower(r.email)=lower(m.email) AND
        (r.sent_at>NOW()-INTERVAL '14 days' OR (r.status='failed' AND r.started_at>NOW()-INTERVAL '14 days')))
      AND NOT EXISTS(SELECT 1 FROM public.email_campaign_recipients r WHERE lower(r.recipient_email)=lower(m.email) AND r.status='sent' AND r.sent_at>NOW()-INTERVAL '14 days'));
$$;
CREATE OR REPLACE FUNCTION public.smart_promotion_audiences()
RETURNS TABLE(segment TEXT,matching BIGINT,eligible BIGINT) LANGUAGE SQL STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT s.segment,count(m.id),count(m.id) FILTER(WHERE public.smart_promotion_eligible(m.id))
  FROM (VALUES('links_no_payment'),('api_not_started'),('inactive30')) s(segment)
  LEFT JOIN public.merchants m ON m.kyc_status='approved' AND public.smart_promotion_segment(m.id,s.segment)
  GROUP BY s.segment;
$$;
CREATE OR REPLACE FUNCTION public.create_smart_promotion(p_segment TEXT,p_limit INTEGER,p_subject TEXT,p_body TEXT,p_sources JSONB,p_admin UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_id UUID;
BEGIN
  IF p_limit<1 OR p_limit>50 THEN RAISE EXCEPTION 'invalid_audience_size'; END IF;
  INSERT INTO public.smart_promotions(segment,subject,body,sources,created_by) VALUES(p_segment,p_subject,p_body,p_sources,p_admin) RETURNING id INTO v_id;
  INSERT INTO public.smart_promotion_recipients(campaign_id,merchant_id,email)
    SELECT v_id,c.id,lower(c.email) FROM (
      SELECT DISTINCT ON(lower(m.email)) m.id,m.email FROM public.merchants m
      WHERE public.smart_promotion_segment(m.id,p_segment) AND public.smart_promotion_eligible(m.id)
      ORDER BY lower(m.email),m.id
    ) c ORDER BY random() LIMIT p_limit;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_eligible_audience'; END IF;
  RETURN v_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.claim_smart_promotion_recipient(p_campaign UUID)
RETURNS SETOF public.smart_promotion_recipients LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r public.smart_promotion_recipients; v_segment TEXT;
BEGIN
  SELECT c.segment INTO v_segment FROM public.smart_promotions c WHERE c.id=p_campaign AND c.status='approved' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  FOR r IN SELECT x.* FROM public.smart_promotion_recipients x WHERE x.campaign_id=p_campaign AND
    (x.status='pending' OR (x.status='sending' AND x.leased_until<NOW() AND x.started_at>NOW()-INTERVAL '23 hours'))
    ORDER BY x.id FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('promotion:'||lower(r.email),0));
    IF NOT public.smart_promotion_eligible(r.merchant_id) OR NOT public.smart_promotion_segment(r.merchant_id,v_segment)
      OR NOT EXISTS(SELECT 1 FROM public.merchants m WHERE m.id=r.merchant_id AND lower(m.email)=r.email)
      OR EXISTS(SELECT 1 FROM public.smart_promotion_recipients x WHERE lower(x.email)=r.email AND x.id<>r.id AND x.status='sending')
    THEN UPDATE public.smart_promotion_recipients SET status='skipped' WHERE id=r.id; CONTINUE; END IF;
    UPDATE public.smart_promotion_recipients SET status='sending',started_at=COALESCE(started_at,NOW()),leased_until=NOW()+INTERVAL '30 minutes',lease_token=gen_random_uuid() WHERE id=r.id RETURNING * INTO r;
    RETURN NEXT r; RETURN;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM public.smart_promotion_recipients x WHERE x.campaign_id=p_campaign AND x.status IN ('pending','sending')) THEN
    UPDATE public.smart_promotions SET status='completed' WHERE id=p_campaign;
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.suppress_smart_promotion(p_recipient UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_email TEXT;
BEGIN
  SELECT lower(email) INTO v_email FROM public.smart_promotion_recipients WHERE id=p_recipient;
  IF v_email IS NOT NULL THEN INSERT INTO public.promotion_suppressions(email) VALUES(v_email) ON CONFLICT DO NOTHING; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.validate_smart_promotion_recipient(p_recipient UUID,p_token UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT EXISTS(SELECT 1 FROM public.smart_promotion_recipients r
    JOIN public.smart_promotions c ON c.id=r.campaign_id JOIN public.merchants m ON m.id=r.merchant_id
    WHERE r.id=p_recipient AND r.lease_token=p_token AND r.status='sending' AND r.leased_until>NOW()
      AND c.status='approved' AND lower(m.email)=r.email
      AND public.smart_promotion_eligible(r.merchant_id) AND public.smart_promotion_segment(r.merchant_id,c.segment));
$$;
REVOKE ALL ON FUNCTION public.validate_smart_promotion_recipient(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_smart_promotion_recipient(UUID,UUID) TO service_role;
REVOKE ALL ON FUNCTION public.smart_promotion_segment(UUID,TEXT),public.smart_promotion_eligible(UUID),public.smart_promotion_audiences(),public.create_smart_promotion(TEXT,INTEGER,TEXT,TEXT,JSONB,UUID),public.claim_smart_promotion_recipient(UUID),public.suppress_smart_promotion(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.smart_promotion_segment(UUID,TEXT),public.smart_promotion_eligible(UUID),public.smart_promotion_audiences(),public.create_smart_promotion(TEXT,INTEGER,TEXT,TEXT,JSONB,UUID),public.claim_smart_promotion_recipient(UUID),public.suppress_smart_promotion(UUID) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
