-- Run only after the review isolation migration and application deployment.
-- Enter the review password yourself below. Never commit the filled-in script.
-- This creates a new account only; it never takes over an existing identity.
BEGIN;
SET LOCAL search_path = public, extensions;
DO $$
DECLARE
  v_password TEXT := 'SET_A_STRONG_PASSWORD_HERE';
  v_user_id UUID := gen_random_uuid();
  v_merchant_id UUID := gen_random_uuid();
BEGIN
  IF v_password = 'SET_A_STRONG_PASSWORD_HERE' OR length(v_password) < 16 THEN
    RAISE EXCEPTION 'Choose a unique review password with at least 16 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.users WHERE lower(email) = 'test@shopify.com')
     OR EXISTS (SELECT 1 FROM public.merchants WHERE lower(email) = 'test@shopify.com') THEN
    RAISE EXCEPTION 'Review identity already exists; refusing to overwrite credentials';
  END IF;
  INSERT INTO public.users(id, email, password_hash, email_verified, first_name, last_name, role, is_active)
  VALUES(v_user_id, 'test@shopify.com', crypt(v_password, gen_salt('bf', 10)), true, 'Shopify', 'Review', 'merchant', true);
  INSERT INTO public.merchants(id, user_id, email, business_name, business_slug, phone, category,
    status, kyc_status, current_environment, account_access, plan_slug, plan_status, shopify_review_mode,
    referral_code, notification_prefs)
  VALUES(v_merchant_id, v_user_id, 'test@shopify.com', 'Shopify Review - Demonstration',
    'shopify-review-' || replace(v_merchant_id::text, '-', ''), '00000000', 'ecommerce',
    'active', 'approved', 'live', 'live', 'free', 'active', true,
    upper(substr(replace(v_merchant_id::text, '-', ''), 1, 12)),
    '{"payments":false,"security":false,"transfers":false,"withdrawals":false}'::jsonb);
  INSERT INTO public.settings(merchant_id, security_json, notifications_json)
  VALUES(v_merchant_id, '{"two_factor_method":"none"}'::jsonb, '{}'::jsonb);
END;
$$;
COMMIT;
SELECT email, shopify_review_mode, available_balance, available_balance_usd
FROM public.merchants WHERE email = 'test@shopify.com';
