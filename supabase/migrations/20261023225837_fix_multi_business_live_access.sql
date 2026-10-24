BEGIN;

-- Legacy validated merchants use live or limited_live; neither is a restriction.
-- Keep identity approval, activity review and account suspension checks intact.

CREATE OR REPLACE FUNCTION private.guard_business_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE owner_row public.merchants;
BEGIN
  IF auth.role() IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF EXISTS (SELECT 1 FROM public.merchants WHERE user_id = NEW.user_id) THEN
        RAISE EXCEPTION 'business_management_server_only';
      END IF;
      IF NEW.identity_owner_merchant_id IS NOT NULL OR NEW.business_creation_key IS NOT NULL
        OR NEW.business_verification_status IS NOT NULL OR NEW.business_review_json <> '{}'::jsonb
        OR NEW.kyc_status = 'approved' OR NEW.kyc_verified_at IS NOT NULL OR NEW.shopify_review_mode THEN
        RAISE EXCEPTION 'business_management_server_only';
      END IF;
    ELSIF NEW.identity_owner_merchant_id IS DISTINCT FROM OLD.identity_owner_merchant_id
      OR NEW.business_creation_key IS DISTINCT FROM OLD.business_creation_key
      OR NEW.business_verification_status IS DISTINCT FROM OLD.business_verification_status
      OR NEW.business_review_json IS DISTINCT FROM OLD.business_review_json
      OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status OR NEW.kyc_verified_at IS DISTINCT FROM OLD.kyc_verified_at
      OR NEW.account_access IS DISTINCT FROM OLD.account_access OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.shopify_review_mode IS DISTINCT FROM OLD.shopify_review_mode THEN
      RAISE EXCEPTION 'business_management_server_only';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id AND EXISTS (
    SELECT 1 FROM public.merchants WHERE identity_owner_merchant_id = OLD.id
  ) THEN RAISE EXCEPTION 'business_identity_owner_immutable'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.identity_owner_merchant_id IS NOT NULL AND
    (NEW.identity_owner_merchant_id IS DISTINCT FROM OLD.identity_owner_merchant_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'business_identity_owner_immutable';
  END IF;
  IF NEW.identity_owner_merchant_id IS NOT NULL THEN
    SELECT * INTO owner_row FROM public.merchants WHERE id = NEW.identity_owner_merchant_id;
    IF owner_row.id IS NULL OR owner_row.user_id IS DISTINCT FROM NEW.user_id OR owner_row.identity_owner_merchant_id IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_business_identity_owner';
    END IF;
    IF NEW.kyc_status = 'approved' AND (NEW.business_verification_status IS DISTINCT FROM 'approved'
      OR owner_row.kyc_status IS DISTINCT FROM 'approved' OR owner_row.status IS DISTINCT FROM 'active'
      OR COALESCE(owner_row.account_access, 'active') NOT IN ('active', 'live', 'limited_live') OR owner_row.shopify_review_mode) THEN
      RAISE EXCEPTION 'verified_owner_and_activity_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_additional_business(
  p_user_id uuid, p_source_merchant_id uuid, p_request_id uuid, p_name text,
  p_category text, p_phone text, p_address text, p_description text, p_website text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE source_row public.merchants; owner_row public.merchants; new_id uuid; previous_id uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('create-business:' || p_user_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = true) THEN RAISE EXCEPTION 'verified_owner_required'; END IF;
  SELECT * INTO source_row FROM public.merchants WHERE id = p_source_merchant_id AND user_id = p_user_id;
  IF source_row.id IS NULL THEN RAISE EXCEPTION 'verified_owner_required'; END IF;
  SELECT * INTO owner_row FROM public.merchants WHERE id = COALESCE(source_row.identity_owner_merchant_id, source_row.id) FOR SHARE;
  IF owner_row.user_id IS DISTINCT FROM p_user_id OR owner_row.kyc_status IS DISTINCT FROM 'approved'
    OR owner_row.status IS DISTINCT FROM 'active' OR COALESCE(owner_row.account_access, 'active') NOT IN ('active', 'live', 'limited_live')
    OR owner_row.shopify_review_mode OR source_row.status IS DISTINCT FROM 'active'
    OR COALESCE(source_row.account_access, 'active') NOT IN ('active', 'live', 'limited_live') THEN RAISE EXCEPTION 'verified_owner_required'; END IF;
  SELECT id INTO previous_id FROM public.merchants WHERE user_id = p_user_id AND business_creation_key = p_request_id;
  IF previous_id IS NOT NULL THEN RETURN previous_id; END IF;
  IF p_request_id IS NULL OR length(btrim(p_name)) NOT BETWEEN 2 AND 255 OR length(btrim(p_category)) NOT BETWEEN 2 AND 100
    OR length(btrim(p_phone)) NOT BETWEEN 8 AND 25 OR length(btrim(p_address)) NOT BETWEEN 5 AND 500
    OR length(btrim(p_description)) NOT BETWEEN 20 AND 2000 THEN RAISE EXCEPTION 'invalid_business_details'; END IF;
  IF (SELECT count(*) FROM public.merchants WHERE user_id = p_user_id AND business_creation_key IS NOT NULL
      AND created_at > now() - interval '1 hour') >= 5 THEN RAISE EXCEPTION 'business_creation_rate_limit'; END IF;
  INSERT INTO public.merchants(user_id, business_name, business_slug, email, phone, address, category,
    status, account_access, kyc_status, current_environment, identity_owner_merchant_id,
    business_verification_status, business_creation_key, business_review_json,
    available_balance, pending_balance, reserved_balance)
  VALUES (p_user_id, btrim(p_name), 'business-' || p_request_id::text, owner_row.email, btrim(p_phone), btrim(p_address), btrim(p_category),
    'active', 'active', 'in_review', 'test', owner_row.id, 'pending', p_request_id,
    jsonb_build_object('description', btrim(p_description), 'website', p_website, 'submitted_at', now()), 0, 0, 0)
  RETURNING id INTO new_id;
  INSERT INTO public.kyc_profiles(merchant_id, status, metadata)
  VALUES (new_id, 'in_review', jsonb_build_object('verification_kind', 'additional_business', 'identity_owner_merchant_id', owner_row.id))
  ON CONFLICT (merchant_id) DO NOTHING;
  INSERT INTO public.settings(merchant_id, security_json, notifications_json) VALUES (new_id, '{}'::jsonb, '{}'::jsonb)
    ON CONFLICT (merchant_id) DO NOTHING;
  INSERT INTO public.audit_logs(merchant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (new_id, p_user_id, 'business.created', 'merchants', new_id, jsonb_build_object('identity_owner_merchant_id', owner_row.id));
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_additional_business(p_merchant_id uuid, p_admin_id uuid, p_approved boolean, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE business public.merchants; identity_owner public.merchants;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.super_admins WHERE id = p_admin_id AND is_active = true AND role IN ('super_admin','compliance')) THEN
    RAISE EXCEPTION 'compliance_admin_required';
  END IF;
  SELECT * INTO business FROM public.merchants WHERE id = p_merchant_id AND identity_owner_merchant_id IS NOT NULL;
  IF business.id IS NULL THEN RAISE EXCEPTION 'additional_business_not_found'; END IF;
  SELECT * INTO identity_owner FROM public.merchants WHERE id = business.identity_owner_merchant_id FOR SHARE;
  SELECT * INTO business FROM public.merchants WHERE id = p_merchant_id FOR UPDATE;
  IF business.status <> 'active' OR COALESCE(business.account_access, 'active') NOT IN ('active', 'live', 'limited_live') THEN RAISE EXCEPTION 'business_restricted'; END IF;
  IF business.business_verification_status NOT IN ('pending','rejected')
    OR business.kyc_status NOT IN ('in_review','rejected','pending_reverification') THEN RAISE EXCEPTION 'business_not_in_review'; END IF;
  IF p_approved AND (identity_owner.user_id IS DISTINCT FROM business.user_id OR identity_owner.kyc_status IS DISTINCT FROM 'approved'
    OR identity_owner.status IS DISTINCT FROM 'active' OR COALESCE(identity_owner.account_access, 'active') NOT IN ('active', 'live', 'limited_live')
    OR identity_owner.shopify_review_mode) THEN RAISE EXCEPTION 'verified_owner_required'; END IF;
  UPDATE public.merchants SET business_verification_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    kyc_status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    kyc_verified_at = CASE WHEN p_approved THEN now() ELSE NULL END,
    current_environment = CASE WHEN p_approved THEN 'live' ELSE 'test' END,
    business_review_json = business_review_json || jsonb_build_object('reviewed_by',p_admin_id,'reviewed_at',now(),'note',left(p_note,2000)),
    updated_at = now() WHERE id = business.id;
  UPDATE public.kyc_profiles SET status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    reviewed_by = p_admin_id, rejection_reason = CASE WHEN p_approved THEN NULL ELSE left(p_note,2000) END,
    approved_at = CASE WHEN p_approved THEN now() ELSE NULL END, rejected_at = CASE WHEN p_approved THEN NULL ELSE now() END
    WHERE merchant_id = business.id;
  INSERT INTO public.audit_logs(admin_id,merchant_id,action,entity_type,entity_id,metadata)
  VALUES (p_admin_id,business.id,CASE WHEN p_approved THEN 'business.approved' ELSE 'business.rejected' END,
    'merchants',business.id,jsonb_build_object('identity_owner_merchant_id',identity_owner.id,'note',left(p_note,2000)));
END;
$$;

CREATE OR REPLACE FUNCTION private.restrict_businesses_with_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.identity_owner_merchant_id IS NULL AND (NEW.kyc_status IS DISTINCT FROM 'approved'
    OR NEW.status IS DISTINCT FROM 'active' OR COALESCE(NEW.account_access, 'active') NOT IN ('active', 'live', 'limited_live')) THEN
    UPDATE public.merchants SET kyc_status = 'in_review', current_environment = 'test',
      business_verification_status = 'pending', updated_at = now(),
      business_review_json = business_review_json || jsonb_build_object('owner_reverification_required_at',now())
    WHERE identity_owner_merchant_id = NEW.id AND kyc_status = 'approved';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_additional_business_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE business public.merchants; identity_owner public.merchants;
BEGIN
  SELECT * INTO business FROM public.merchants WHERE id = NEW.merchant_id;
  IF business.identity_owner_merchant_id IS NULL THEN RETURN NEW; END IF;
  IF auth.role() IN ('anon','authenticated') THEN RAISE EXCEPTION 'business_operation_server_only'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id = NEW.merchant_id AND OLD.environment IS NOT DISTINCT FROM NEW.environment THEN RETURN NEW; END IF;
  IF NEW.environment IS DISTINCT FROM 'live' THEN RETURN NEW; END IF;
  SELECT * INTO identity_owner FROM public.merchants WHERE id = business.identity_owner_merchant_id;
  IF business.business_verification_status IS DISTINCT FROM 'approved' OR business.kyc_status IS DISTINCT FROM 'approved'
    OR business.status IS DISTINCT FROM 'active' OR COALESCE(business.account_access, 'active') NOT IN ('active', 'live', 'limited_live')
    OR identity_owner.user_id IS DISTINCT FROM business.user_id OR identity_owner.kyc_status IS DISTINCT FROM 'approved'
    OR identity_owner.status IS DISTINCT FROM 'active' OR COALESCE(identity_owner.account_access, 'active') NOT IN ('active', 'live', 'limited_live') THEN
    RAISE EXCEPTION 'business_review_required';
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
