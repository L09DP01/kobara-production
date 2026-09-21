-- Complete the partner program with atomic invitation, payout and reporting operations.

ALTER TABLE public.partner_applications
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS legal_company_name TEXT,
  ADD COLUMN IF NOT EXISTS trading_name TEXT,
  ADD COLUMN IF NOT EXISTS business_type TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS products_services TEXT,
  ADD COLUMN IF NOT EXISTS desired_payment_methods TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS primary_need TEXT;

ALTER TABLE public.partner_withdrawals
  ADD COLUMN IF NOT EXISTS destination_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.super_admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.developer_accounts DROP CONSTRAINT IF EXISTS developer_accounts_activated_by_fkey;
ALTER TABLE public.developer_accounts ADD CONSTRAINT developer_accounts_activated_by_fkey
  FOREIGN KEY (activated_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.ambassador_accounts DROP CONSTRAINT IF EXISTS ambassador_accounts_activated_by_fkey;
ALTER TABLE public.ambassador_accounts ADD CONSTRAINT ambassador_accounts_activated_by_fkey
  FOREIGN KEY (activated_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.partner_applications DROP CONSTRAINT IF EXISTS partner_applications_reviewed_by_fkey;
ALTER TABLE public.partner_applications ADD CONSTRAINT partner_applications_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;

ALTER TABLE public.partner_commission_ledger
  ADD COLUMN IF NOT EXISTS partner_withdrawal_id UUID REFERENCES public.partner_withdrawals(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.merchant_monthly_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  statement_month DATE NOT NULL,
  payment_count INTEGER NOT NULL DEFAULT 0,
  gross_htg NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_htg NUMERIC(15,2) NOT NULL DEFAULT 0,
  fees_htg NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_usd NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_usd NUMERIC(15,2) NOT NULL DEFAULT 0,
  fees_usd NUMERIC(15,2) NOT NULL DEFAULT 0,
  withdrawals_htg NUMERIC(15,2) NOT NULL DEFAULT 0,
  withdrawals_usd NUMERIC(15,2) NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed')),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, statement_month),
  CHECK (statement_month = DATE_TRUNC('month', statement_month)::DATE)
);
ALTER TABLE public.merchant_monthly_statements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.merchant_monthly_statements FROM anon, authenticated;
GRANT ALL ON TABLE public.merchant_monthly_statements TO service_role;
CREATE INDEX IF NOT EXISTS merchant_monthly_statements_merchant_month_idx
  ON public.merchant_monthly_statements (merchant_id, statement_month DESC);
DROP TRIGGER IF EXISTS update_merchant_statements_modtime ON public.merchant_monthly_statements;
CREATE TRIGGER update_merchant_statements_modtime BEFORE UPDATE ON public.merchant_monthly_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS partner_commission_withdrawal_idx
  ON public.partner_commission_ledger (partner_withdrawal_id)
  WHERE partner_withdrawal_id IS NOT NULL;

INSERT INTO public.referral_attributions (merchant_id, source_type, source_reference)
SELECT merchant.id, 'direct', 'migration:20260920235900'
FROM public.merchants merchant
WHERE NOT EXISTS (
  SELECT 1 FROM public.referral_attributions attribution WHERE attribution.merchant_id = merchant.id
)
ON CONFLICT (merchant_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.accept_developer_invitation(
  p_token_hash TEXT,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_invitation public.developer_invitations%ROWTYPE;
  v_merchant public.merchants%ROWTYPE;
  v_connection_id UUID;
BEGIN
  SELECT * INTO v_invitation
  FROM public.developer_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_invitation.status <> 'pending' OR v_invitation.expires_at <= NOW() THEN
    RAISE EXCEPTION 'developer_invitation_invalid_or_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_merchant
  FROM public.merchants
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR LOWER(COALESCE(v_merchant.email, '')) <> LOWER(v_invitation.invited_email) THEN
    RAISE EXCEPTION 'developer_invitation_email_mismatch' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE merchant_id = v_merchant.id) THEN
    RAISE EXCEPTION 'merchant_attribution_already_exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.developer_merchant_connections (
    developer_id, merchant_id, invitation_id, status
  ) VALUES (
    v_invitation.developer_id, v_merchant.id, v_invitation.id, 'connected'
  ) RETURNING id INTO v_connection_id;

  INSERT INTO public.referral_attributions (
    merchant_id, source_type, developer_connection_id, source_reference
  ) VALUES (
    v_merchant.id, 'developer_referral', v_connection_id, v_invitation.id::TEXT
  );

  UPDATE public.developer_invitations
  SET status = 'accepted', merchant_id = v_merchant.id, accepted_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;

  INSERT INTO public.audit_logs (merchant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_merchant.id, p_user_id, 'developer.invitation_accepted', 'developer_merchant_connections', v_connection_id,
    jsonb_build_object('developer_id', v_invitation.developer_id, 'invitation_id', v_invitation.id));

  RETURN v_connection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_merchant_referral(
  p_token_hash TEXT,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral public.merchant_referrals%ROWTYPE;
  v_merchant public.merchants%ROWTYPE;
BEGIN
  SELECT * INTO v_referral
  FROM public.merchant_referrals
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_referral.status <> 'pending' OR v_referral.expires_at <= NOW() THEN
    RAISE EXCEPTION 'merchant_referral_invalid_or_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_merchant FROM public.merchants WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND OR LOWER(COALESCE(v_merchant.email, '')) <> LOWER(v_referral.invited_email) THEN
    RAISE EXCEPTION 'merchant_referral_email_mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_merchant.id = v_referral.referrer_merchant_id THEN
    RAISE EXCEPTION 'merchant_referral_self_referral' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.referral_attributions WHERE merchant_id = v_merchant.id) THEN
    RAISE EXCEPTION 'merchant_attribution_already_exists' USING ERRCODE = '23505';
  END IF;

  UPDATE public.merchant_referrals
  SET invited_merchant_id = v_merchant.id, status = 'account_created', updated_at = NOW()
  WHERE id = v_referral.id;

  INSERT INTO public.referral_attributions (
    merchant_id, source_type, merchant_referral_id, source_reference
  ) VALUES (
    v_merchant.id, 'merchant_referral', v_referral.id, v_referral.id::TEXT
  );

  INSERT INTO public.audit_logs (merchant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (v_merchant.id, p_user_id, 'merchant_referral.accepted', 'merchant_referrals', v_referral.id,
    jsonb_build_object('referrer_merchant_id', v_referral.referrer_merchant_id));

  RETURN v_referral.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_partner_withdrawal(
  p_beneficiary_type TEXT,
  p_beneficiary_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_destination_type TEXT,
  p_destination_masked TEXT,
  p_destination_encrypted TEXT,
  p_idempotency_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_withdrawal_id UUID;
  v_available NUMERIC;
  v_selected NUMERIC := 0;
  v_entry RECORD;
BEGIN
  IF p_beneficiary_type NOT IN ('developer', 'ambassador', 'merchant_referral')
     OR UPPER(p_currency) NOT IN ('HTG', 'USD') OR p_amount <= 0 THEN
    RAISE EXCEPTION 'partner_withdrawal_invalid' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_beneficiary_type || ':' || p_beneficiary_id::TEXT || ':' || UPPER(p_currency), 0));

  SELECT COALESCE(SUM(amount), 0) INTO v_available
  FROM public.partner_commission_ledger
  WHERE beneficiary_type = p_beneficiary_type
    AND currency = UPPER(p_currency)
    AND status = 'available'
    AND ((p_beneficiary_type = 'developer' AND developer_id = p_beneficiary_id)
      OR (p_beneficiary_type = 'ambassador' AND ambassador_id = p_beneficiary_id)
      OR (p_beneficiary_type = 'merchant_referral' AND merchant_id = p_beneficiary_id));

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'partner_withdrawal_insufficient_balance:%', v_available USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.partner_withdrawals (
    beneficiary_type, developer_id, ambassador_id, merchant_id, amount, fees, total, currency,
    destination_type, destination_masked, destination_encrypted, status, idempotency_key
  ) VALUES (
    p_beneficiary_type,
    CASE WHEN p_beneficiary_type = 'developer' THEN p_beneficiary_id END,
    CASE WHEN p_beneficiary_type = 'ambassador' THEN p_beneficiary_id END,
    CASE WHEN p_beneficiary_type = 'merchant_referral' THEN p_beneficiary_id END,
    p_amount, 0, p_amount, UPPER(p_currency), p_destination_type,
    p_destination_masked, p_destination_encrypted, 'pending', p_idempotency_key
  ) RETURNING id INTO v_withdrawal_id;

  FOR v_entry IN
    SELECT id, amount FROM public.partner_commission_ledger
    WHERE beneficiary_type = p_beneficiary_type AND currency = UPPER(p_currency) AND status = 'available'
      AND ((p_beneficiary_type = 'developer' AND developer_id = p_beneficiary_id)
        OR (p_beneficiary_type = 'ambassador' AND ambassador_id = p_beneficiary_id)
        OR (p_beneficiary_type = 'merchant_referral' AND merchant_id = p_beneficiary_id))
    ORDER BY available_at NULLS FIRST, created_at, id
    FOR UPDATE
  LOOP
    EXIT WHEN v_selected >= p_amount;
    IF v_selected + v_entry.amount > p_amount THEN
      INSERT INTO public.partner_commission_ledger (
        beneficiary_type, developer_id, ambassador_id, merchant_id, source_merchant_id,
        source_payment_id, source_subscription_id, entry_type, amount, currency, status,
        available_at, idempotency_key, metadata
      )
      SELECT beneficiary_type, developer_id, ambassador_id, merchant_id, source_merchant_id,
        source_payment_id, source_subscription_id, entry_type,
        amount - (p_amount - v_selected), currency, 'available', available_at,
        idempotency_key || ':remainder:' || v_withdrawal_id::TEXT,
        metadata || jsonb_build_object('split_from', id)
      FROM public.partner_commission_ledger WHERE id = v_entry.id;

      UPDATE public.partner_commission_ledger
      SET amount = p_amount - v_selected, status = 'pending', partner_withdrawal_id = v_withdrawal_id
      WHERE id = v_entry.id;
      v_selected := p_amount;
      EXIT;
    END IF;
    UPDATE public.partner_commission_ledger
    SET status = 'pending', partner_withdrawal_id = v_withdrawal_id
    WHERE id = v_entry.id;
    v_selected := v_selected + v_entry.amount;
  END LOOP;

  IF v_selected <> p_amount THEN
    RAISE EXCEPTION 'partner_withdrawal_exact_amount_required' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_withdrawal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_partner_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_admin_id UUID,
  p_failure_reason TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_current_status TEXT;
BEGIN
  IF p_status NOT IN ('processing', 'completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'partner_withdrawal_status_invalid' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_current_status FROM public.partner_withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND OR v_current_status IN ('completed', 'failed', 'cancelled') THEN
    RAISE EXCEPTION 'partner_withdrawal_not_reviewable' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.partner_withdrawals SET status = p_status, reviewed_by = p_admin_id,
    reviewed_at = NOW(), completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
    failure_reason = p_failure_reason
  WHERE id = p_withdrawal_id;

  IF p_status = 'completed' THEN
    UPDATE public.partner_commission_ledger SET status = 'paid', paid_at = NOW()
    WHERE partner_withdrawal_id = p_withdrawal_id;
  ELSIF p_status IN ('failed', 'cancelled') THEN
    UPDATE public.partner_commission_ledger SET status = 'available', partner_withdrawal_id = NULL
    WHERE partner_withdrawal_id = p_withdrawal_id AND status = 'pending';
  END IF;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, 'partner_withdrawal.' || p_status, 'partner_withdrawals', p_withdrawal_id,
    jsonb_build_object('previous_status', v_current_status, 'failure_reason', p_failure_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.release_partner_commissions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.partner_commission_ledger
  SET status = 'available', available_at = COALESCE(available_at, NOW())
  WHERE status = 'pending' AND partner_withdrawal_id IS NULL AND COALESCE(available_at, created_at) <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_merchant_referral_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.beneficiary_type = 'merchant_referral' AND NEW.merchant_id IS NOT NULL
     AND NEW.entry_type = 'merchant_referral_reward' THEN
    IF NEW.currency = 'USD' THEN
      UPDATE public.merchants SET available_balance_usd = COALESCE(available_balance_usd, 0) + NEW.amount,
        updated_at = NOW() WHERE id = NEW.merchant_id;
    ELSE
      UPDATE public.merchants SET available_balance = COALESCE(available_balance, 0) + NEW.amount,
        updated_at = NOW() WHERE id = NEW.merchant_id;
    END IF;
    NEW.status := 'paid';
    NEW.paid_at := NOW();
  ELSIF NEW.beneficiary_type = 'merchant_referral' AND NEW.merchant_id IS NOT NULL
        AND NEW.entry_type = 'reversal' AND NEW.status = 'reversed' THEN
    IF NEW.currency = 'USD' THEN
      UPDATE public.merchants SET available_balance_usd = COALESCE(available_balance_usd, 0) - NEW.amount,
        updated_at = NOW() WHERE id = NEW.merchant_id;
    ELSE
      UPDATE public.merchants SET available_balance = COALESCE(available_balance, 0) - NEW.amount,
        updated_at = NOW() WHERE id = NEW.merchant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credit_merchant_referral_reward ON public.partner_commission_ledger;
CREATE TRIGGER credit_merchant_referral_reward
  BEFORE INSERT ON public.partner_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.credit_merchant_referral_reward();

REVOKE ALL ON FUNCTION public.accept_developer_invitation(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.accept_merchant_referral(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.request_partner_withdrawal(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.review_partner_withdrawal(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_partner_commissions() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.credit_merchant_referral_reward() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_developer_invitation(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.accept_merchant_referral(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_partner_withdrawal(TEXT, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.review_partner_withdrawal(UUID, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_partner_commissions() TO service_role;
