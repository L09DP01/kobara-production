BEGIN;

-- Reuse the existing verified KYC decision. Approval is based on persisted
-- evidence and access controls, never on a client or language-model assertion.
CREATE OR REPLACE FUNCTION public.auto_activate_additional_business(p_merchant_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE business public.merchants; identity_owner public.merchants; owner_id uuid;
BEGIN
  SELECT identity_owner_merchant_id INTO owner_id FROM public.merchants
    WHERE id = p_merchant_id AND user_id = p_user_id;
  IF owner_id IS NULL THEN RETURN false; END IF;
  SELECT * INTO identity_owner FROM public.merchants WHERE id = owner_id FOR SHARE;
  SELECT * INTO business FROM public.merchants WHERE id = p_merchant_id AND user_id = p_user_id FOR UPDATE;
  IF business.id IS NULL OR business.identity_owner_merchant_id IS DISTINCT FROM owner_id
    OR identity_owner.user_id IS DISTINCT FROM p_user_id OR identity_owner.identity_owner_merchant_id IS NOT NULL THEN RETURN false; END IF;
  IF business.business_verification_status IS DISTINCT FROM 'pending' OR COALESCE(business.kyc_status,'') NOT IN ('pending','in_review')
    OR business.status IS DISTINCT FROM 'active' OR COALESCE(business.account_access,'active') NOT IN ('active','live','limited_live')
    OR business.shopify_review_mode OR identity_owner.shopify_review_mode
    OR identity_owner.kyc_status IS DISTINCT FROM 'approved' OR identity_owner.kyc_verified_at IS NULL
    OR identity_owner.status IS DISTINCT FROM 'active' OR COALESCE(identity_owner.account_access,'active') NOT IN ('active','live','limited_live')
    OR business.business_review_json ? 'reviewed_at' OR business.business_review_json ? 'owner_reverification_required_at'
    OR business.business_review_json->>'manual_hold' = 'true' THEN RETURN false; END IF;
  PERFORM 1 FROM public.users WHERE id = p_user_id AND is_active = true AND email_verified = true FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.kyc_profiles WHERE merchant_id = owner_id AND status = 'approved' FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.kyc_profiles WHERE merchant_id = business.id AND status IN ('pending','in_review')
    AND reviewed_by IS NULL AND rejected_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF length(btrim(COALESCE(business.business_name,''))) < 2 OR length(btrim(COALESCE(business.category,''))) < 2
    OR length(btrim(COALESCE(business.address,''))) < 5 OR length(btrim(COALESCE(business.phone,''))) < 8
    OR length(btrim(COALESCE(business.business_review_json->>'description',''))) < 20 THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.merchant_restrictions r JOIN public.merchants m ON m.id=r.merchant_id
      WHERE m.user_id=p_user_id AND r.lifted_at IS NULL)
    OR EXISTS (SELECT 1 FROM public.compliance_cases c JOIN public.merchants m ON m.id=c.merchant_id
      WHERE m.user_id=p_user_id AND c.case_status IS DISTINCT FROM 'closed')
    OR EXISTS (SELECT 1 FROM public.kyc_fraud_cases f WHERE f.status NOT IN ('resolved','false_positive') AND (
      (f.primary_merchant_id IN (SELECT id FROM public.merchants WHERE user_id=p_user_id) AND COALESCE(f.primary_verdict,'') <> 'legitimate')
      OR (f.related_merchant_id IN (SELECT id FROM public.merchants WHERE user_id=p_user_id) AND COALESCE(f.related_verdict,'') <> 'legitimate')))
    THEN RETURN false; END IF;
  UPDATE public.merchants SET business_verification_status='approved', kyc_status='approved',
    kyc_verified_at=now(), current_environment='live', updated_at=now(),
    business_review_json=business_review_json || jsonb_build_object('reviewed_at',now(),
      'decision_source','verified_kyc_reuse','policy_version','verified_owner_v1',
      'note','Activation automatique : identité du propriétaire validée et aucune restriction en cours.')
    WHERE id=business.id;
  UPDATE public.kyc_profiles SET status='approved', approved_at=now(), rejected_at=NULL, rejection_reason=NULL,
    metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('decision_source','verified_kyc_reuse','policy_version','verified_owner_v1')
    WHERE merchant_id=business.id;
  INSERT INTO public.audit_logs(merchant_id,user_id,action,entity_type,entity_id,metadata)
    VALUES(business.id,p_user_id,'business.auto_approved','merchants',business.id,
      jsonb_build_object('identity_owner_merchant_id',owner_id,'decision_source','verified_kyc_reuse','environment','live','policy_version','verified_owner_v1'));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.auto_activate_additional_business(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auto_activate_additional_business(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.additional_business_production_only() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.identity_owner_merchant_id IS NOT NULL AND NOT COALESCE(NEW.shopify_review_mode,false) THEN NEW.current_environment := 'live'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.additional_business_production_only() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER additional_business_production_only BEFORE INSERT OR UPDATE ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION private.additional_business_production_only();

-- Update the pending business's KYC record before the automatic check runs.
-- Both inserts and activation remain in the original creation transaction.
CREATE OR REPLACE FUNCTION private.auto_activate_business_after_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE owner_user uuid;
BEGIN
  IF auth.role() IN ('anon','authenticated') THEN RETURN NEW; END IF;
  SELECT user_id INTO owner_user FROM public.merchants WHERE id=NEW.merchant_id AND identity_owner_merchant_id IS NOT NULL;
  IF owner_user IS NOT NULL THEN PERFORM public.auto_activate_additional_business(NEW.merchant_id,owner_user); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.auto_activate_business_after_profile() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER auto_activate_business_after_profile AFTER INSERT ON public.kyc_profiles
  FOR EACH ROW EXECUTE FUNCTION private.auto_activate_business_after_profile();

CREATE OR REPLACE FUNCTION private.guard_additional_business_operation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE business public.merchants; identity_owner public.merchants;
BEGIN
  SELECT * INTO business FROM public.merchants WHERE id = NEW.merchant_id;
  IF business.identity_owner_merchant_id IS NULL THEN RETURN NEW; END IF;
  IF auth.role() IN ('anon','authenticated') THEN RAISE EXCEPTION 'business_operation_server_only'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.merchant_id = NEW.merchant_id AND OLD.environment IS NOT DISTINCT FROM NEW.environment THEN RETURN NEW; END IF;
  IF NEW.environment IS DISTINCT FROM 'live' THEN RAISE EXCEPTION 'additional_business_production_only'; END IF;
  SELECT * INTO identity_owner FROM public.merchants WHERE id = business.identity_owner_merchant_id;
  IF business.business_verification_status IS DISTINCT FROM 'approved' OR business.kyc_status IS DISTINCT FROM 'approved'
    OR business.status IS DISTINCT FROM 'active' OR COALESCE(business.account_access,'active') NOT IN ('active','live','limited_live')
    OR identity_owner.user_id IS DISTINCT FROM business.user_id OR identity_owner.kyc_status IS DISTINCT FROM 'approved'
    OR identity_owner.status IS DISTINCT FROM 'active' OR COALESCE(identity_owner.account_access,'active') NOT IN ('active','live','limited_live') THEN
    RAISE EXCEPTION 'business_review_required';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_business_live_link BEFORE INSERT OR UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION private.guard_additional_business_operation();

-- Apply the same eligibility checks to existing pending activities, without
-- overwriting manual reviews, restrictions or demo accounts.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT id,user_id FROM public.merchants WHERE identity_owner_merchant_id IS NOT NULL
    AND business_verification_status='pending' AND kyc_status IN ('pending','in_review') ORDER BY created_at,id
  LOOP PERFORM public.auto_activate_additional_business(item.id,item.user_id); END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
