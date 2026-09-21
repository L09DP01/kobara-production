-- Stable, customizable merchant referral links.

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS referral_code TEXT;

UPDATE public.merchants
SET referral_code = LEFT(
      COALESCE(NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(COALESCE(NULLIF(business_slug, ''), business_name)), '[^a-z0-9]+', '-', 'g')), ''), 'marchand'),
      30
    ) || '-' || LEFT(REPLACE(id::TEXT, '-', ''), 8)
WHERE referral_code IS NULL OR BTRIM(referral_code) = '';

CREATE OR REPLACE FUNCTION public.ensure_merchant_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base TEXT;
BEGIN
  IF NEW.referral_code IS NULL OR BTRIM(NEW.referral_code) = '' THEN
    v_base := TRIM(BOTH '-' FROM REGEXP_REPLACE(
      LOWER(COALESCE(NULLIF(NEW.business_slug, ''), NEW.business_name, 'marchand')),
      '[^a-z0-9]+', '-', 'g'
    ));
    IF v_base = '' THEN v_base := 'marchand'; END IF;
    NEW.referral_code := LEFT(v_base, 30) || '-' || LEFT(REPLACE(NEW.id::TEXT, '-', ''), 8);
  END IF;
  NEW.referral_code := LOWER(BTRIM(NEW.referral_code));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_merchant_referral_code ON public.merchants;
CREATE TRIGGER ensure_merchant_referral_code
  BEFORE INSERT OR UPDATE OF referral_code ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.ensure_merchant_referral_code();

ALTER TABLE public.merchants
  ALTER COLUMN referral_code SET NOT NULL;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_referral_code_format_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_referral_code_format_check
  CHECK (referral_code ~ '^[a-z0-9][a-z0-9-]{2,39}$');

CREATE UNIQUE INDEX IF NOT EXISTS merchants_referral_code_unique_idx
  ON public.merchants (LOWER(referral_code));

CREATE OR REPLACE FUNCTION public.accept_merchant_referral_code(
  p_referral_code TEXT,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referrer public.merchants%ROWTYPE;
  v_invited public.merchants%ROWTYPE;
  v_referral_id UUID;
BEGIN
  SELECT * INTO v_referrer
  FROM public.merchants
  WHERE LOWER(referral_code) = LOWER(BTRIM(p_referral_code));

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_referral_code_invalid' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invited
  FROM public.merchants
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_referral_merchant_missing' USING ERRCODE = 'P0001';
  END IF;
  IF v_invited.id = v_referrer.id THEN
    RAISE EXCEPTION 'merchant_referral_self_referral' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE merchant_id = v_invited.id) THEN
    RAISE EXCEPTION 'merchant_attribution_already_exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.merchant_referrals (
    referrer_merchant_id,
    invited_merchant_id,
    invited_email,
    token_hash,
    status,
    reward_currency,
    expires_at
  ) VALUES (
    v_referrer.id,
    v_invited.id,
    LOWER(v_invited.email),
    REPLACE(uuid_generate_v4()::TEXT, '-', '') || REPLACE(uuid_generate_v4()::TEXT, '-', ''),
    'account_created',
    'HTG',
    NOW() + INTERVAL '365 days'
  ) RETURNING id INTO v_referral_id;

  INSERT INTO public.referral_attributions (
    merchant_id, source_type, merchant_referral_id, source_reference
  ) VALUES (
    v_invited.id, 'merchant_referral', v_referral_id, LOWER(v_referrer.referral_code)
  );

  INSERT INTO public.audit_logs (merchant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_invited.id,
    p_user_id,
    'merchant_referral.link_accepted',
    'merchant_referrals',
    v_referral_id,
    jsonb_build_object('referrer_merchant_id', v_referrer.id, 'referral_code', v_referrer.referral_code)
  );

  RETURN v_referral_id;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_merchant_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_merchant_referral_code(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_merchant_referral_code(TEXT, UUID) TO service_role;

COMMENT ON COLUMN public.merchants.referral_code IS
  'Stable merchant-controlled code used by public referral links.';
