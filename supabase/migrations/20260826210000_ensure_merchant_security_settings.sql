-- Ensure every merchant has a security settings row and make withdrawal OTP
-- issuance/consumption atomic. RPC execution is restricted to service_role.

INSERT INTO public.settings (
  merchant_id,
  transaction_fee_percent,
  settlement_method,
  security_json
)
SELECT
  merchant.id,
  2.90,
  'manual',
  '{"two_factor_method":"none"}'::jsonb
FROM public.merchants AS merchant
ON CONFLICT (merchant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION private.ensure_merchant_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.settings (
    merchant_id,
    transaction_fee_percent,
    settlement_method,
    security_json
  )
  VALUES (
    NEW.id,
    2.90,
    'manual',
    '{"two_factor_method":"none"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.ensure_merchant_settings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS ensure_merchant_settings_after_insert ON public.merchants;
CREATE TRIGGER ensure_merchant_settings_after_insert
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION private.ensure_merchant_settings();

CREATE OR REPLACE FUNCTION public.issue_withdrawal_otp(
  p_merchant_id uuid,
  p_otp_hash text,
  p_expires_at timestamptz,
  p_sent_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_security jsonb;
  v_lockout_until timestamptz;
  v_last_sent_at timestamptz;
  v_remaining_seconds integer;
BEGIN
  INSERT INTO public.settings (
    merchant_id,
    transaction_fee_percent,
    settlement_method,
    security_json
  )
  VALUES (
    p_merchant_id,
    2.90,
    'manual',
    '{"two_factor_method":"none"}'::jsonb
  )
  ON CONFLICT (merchant_id) DO NOTHING;

  SELECT COALESCE(settings.security_json, '{}'::jsonb)
  INTO v_security
  FROM public.settings AS settings
  WHERE settings.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_security IS NULL THEN
    RETURN jsonb_build_object('status', 'settings_missing');
  END IF;

  BEGIN
    v_lockout_until := NULLIF(v_security->>'email_otp_lockout_until', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_lockout_until := NULL;
  END;

  IF v_lockout_until IS NOT NULL AND v_lockout_until > p_sent_at THEN
    v_remaining_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_lockout_until - p_sent_at)))::integer);
    RETURN jsonb_build_object('status', 'locked', 'remaining_seconds', v_remaining_seconds);
  END IF;

  BEGIN
    v_last_sent_at := NULLIF(v_security->>'email_otp_sent_at', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_last_sent_at := NULL;
  END;

  IF v_last_sent_at IS NOT NULL AND v_last_sent_at > p_sent_at - interval '30 seconds' THEN
    v_remaining_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_last_sent_at + interval '30 seconds') - p_sent_at)))::integer);
    RETURN jsonb_build_object('status', 'cooldown', 'remaining_seconds', v_remaining_seconds);
  END IF;

  UPDATE public.settings
  SET security_json = v_security || jsonb_build_object(
    'email_otp_code', p_otp_hash,
    'email_otp_expires_at', p_expires_at,
    'email_otp_purpose', 'withdrawal',
    'email_otp_attempts', 0,
    'email_otp_sent_at', p_sent_at,
    'email_otp_lockout_until', NULL
  )
  WHERE merchant_id = p_merchant_id;

  RETURN jsonb_build_object('status', 'issued');
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_withdrawal_otp(
  p_merchant_id uuid,
  p_otp_hash text,
  p_now timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_security jsonb;
  v_saved_hash text;
  v_purpose text;
  v_expires_at timestamptz;
  v_lockout_until timestamptz;
  v_attempts integer;
  v_remaining_seconds integer;
BEGIN
  SELECT COALESCE(settings.security_json, '{}'::jsonb)
  INTO v_security
  FROM public.settings AS settings
  WHERE settings.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_security IS NULL THEN
    RETURN jsonb_build_object('status', 'no_code');
  END IF;

  BEGIN
    v_lockout_until := NULLIF(v_security->>'email_otp_lockout_until', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_lockout_until := NULL;
  END;

  IF v_lockout_until IS NOT NULL AND v_lockout_until > p_now THEN
    v_remaining_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_lockout_until - p_now)))::integer);
    RETURN jsonb_build_object('status', 'locked', 'remaining_seconds', v_remaining_seconds);
  END IF;

  v_saved_hash := v_security->>'email_otp_code';
  v_purpose := v_security->>'email_otp_purpose';

  IF v_saved_hash IS NULL OR v_purpose IS DISTINCT FROM 'withdrawal' THEN
    RETURN jsonb_build_object('status', 'no_code');
  END IF;

  BEGIN
    v_expires_at := NULLIF(v_security->>'email_otp_expires_at', '')::timestamptz;
  EXCEPTION WHEN invalid_datetime_format THEN
    v_expires_at := NULL;
  END;

  IF v_expires_at IS NULL OR v_expires_at < p_now THEN
    UPDATE public.settings
    SET security_json = v_security - ARRAY[
      'email_otp_code',
      'email_otp_expires_at',
      'email_otp_purpose',
      'email_otp_attempts',
      'email_otp_sent_at'
    ]
    WHERE merchant_id = p_merchant_id;

    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF v_saved_hash IS DISTINCT FROM p_otp_hash THEN
    v_attempts := COALESCE(NULLIF(v_security->>'email_otp_attempts', '')::integer, 0) + 1;

    IF v_attempts >= 5 THEN
      UPDATE public.settings
      SET security_json = (v_security - ARRAY[
        'email_otp_code',
        'email_otp_expires_at',
        'email_otp_purpose',
        'email_otp_sent_at'
      ]) || jsonb_build_object(
        'email_otp_attempts', v_attempts,
        'email_otp_lockout_until', p_now + interval '5 minutes'
      )
      WHERE merchant_id = p_merchant_id;

      RETURN jsonb_build_object('status', 'locked', 'remaining_seconds', 300);
    END IF;

    UPDATE public.settings
    SET security_json = v_security || jsonb_build_object('email_otp_attempts', v_attempts)
    WHERE merchant_id = p_merchant_id;

    RETURN jsonb_build_object('status', 'invalid', 'remaining_attempts', 5 - v_attempts);
  END IF;

  UPDATE public.settings
  SET security_json = v_security - ARRAY[
    'email_otp_code',
    'email_otp_expires_at',
    'email_otp_purpose',
    'email_otp_attempts',
    'email_otp_lockout_until',
    'email_otp_sent_at'
  ]
  WHERE merchant_id = p_merchant_id;

  RETURN jsonb_build_object('status', 'verified');
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_withdrawal_otp(
  p_merchant_id uuid,
  p_otp_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_security jsonb;
BEGIN
  SELECT COALESCE(settings.security_json, '{}'::jsonb)
  INTO v_security
  FROM public.settings AS settings
  WHERE settings.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_security IS NULL OR v_security->>'email_otp_code' IS DISTINCT FROM p_otp_hash THEN
    RETURN false;
  END IF;

  UPDATE public.settings
  SET security_json = v_security - ARRAY[
    'email_otp_code',
    'email_otp_expires_at',
    'email_otp_purpose',
    'email_otp_attempts',
    'email_otp_lockout_until',
    'email_otp_sent_at'
  ]
  WHERE merchant_id = p_merchant_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_withdrawal_otp(uuid, text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_withdrawal_otp(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_withdrawal_otp(uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.issue_withdrawal_otp(uuid, text, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_withdrawal_otp(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_withdrawal_otp(uuid, text) TO service_role;
