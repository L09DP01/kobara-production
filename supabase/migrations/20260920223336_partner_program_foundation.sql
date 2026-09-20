-- Partner programs foundation: developers, ambassadors and merchant referrals.
-- All partner data remains server-managed. Browser clients receive no direct
-- table privileges; dashboards access it through authenticated server code.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('merchant', 'developer', 'ambassador', 'admin', 'compliance', 'super_admin'));

CREATE TABLE public.developer_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  tier TEXT NOT NULL DEFAULT 'developer' CHECK (tier IN ('developer', 'partner', 'pro_partner', 'agency')),
  commission_rate_override NUMERIC(5, 2) CHECK (commission_rate_override BETWEEN 0 AND 100),
  referral_code TEXT NOT NULL UNIQUE,
  reward_currency TEXT NOT NULL DEFAULT 'USD' CHECK (reward_currency IN ('HTG', 'USD')),
  activated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.developer_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX developer_invitations_pending_email_idx
  ON public.developer_invitations (developer_id, LOWER(invited_email))
  WHERE status = 'pending';

CREATE TABLE public.developer_merchant_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id UUID NOT NULL REFERENCES public.developer_accounts(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  invitation_id UUID UNIQUE REFERENCES public.developer_invitations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'integration', 'live', 'revoked')),
  integration_htg_total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (integration_htg_total >= 0 AND integration_htg_total <= 7000),
  integration_usd_total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (integration_usd_total >= 0 AND integration_usd_total <= 55),
  withdrawal_access BOOLEAN NOT NULL DEFAULT FALSE,
  withdrawal_access_granted_at TIMESTAMPTZ,
  withdrawal_access_granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_merchant_api_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  live_at TIMESTAMPTZ,
  developer_bonus_credited_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (developer_id, merchant_id)
);

CREATE TABLE public.ambassador_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'rejected')),
  promo_code_id UUID UNIQUE REFERENCES public.promo_codes(id) ON DELETE SET NULL,
  reward_currency TEXT NOT NULL DEFAULT 'USD' CHECK (reward_currency IN ('HTG', 'USD')),
  activated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.partner_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_type TEXT NOT NULL CHECK (program_type IN ('developer', 'ambassador')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  website_or_social TEXT,
  experience TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'approved', 'rejected', 'archived')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX partner_applications_status_created_idx
  ON public.partner_applications (status, created_at DESC);

CREATE TABLE public.merchant_referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  invited_merchant_id UUID UNIQUE REFERENCES public.merchants(id) ON DELETE SET NULL,
  invited_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'account_created', 'pro_active', 'volume_pending', 'qualified', 'rewarded', 'expired', 'revoked', 'ineligible')),
  reward_currency TEXT NOT NULL DEFAULT 'HTG' CHECK (reward_currency IN ('HTG', 'USD')),
  qualifying_htg_total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (qualifying_htg_total >= 0),
  qualifying_usd_total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (qualifying_usd_total >= 0),
  pro_activated_at TIMESTAMPTZ,
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (invited_merchant_id IS NULL OR invited_merchant_id <> referrer_merchant_id)
);

CREATE UNIQUE INDEX merchant_referrals_pending_email_idx
  ON public.merchant_referrals (referrer_merchant_id, LOWER(invited_email))
  WHERE status = 'pending';

CREATE TABLE public.merchant_referral_payment_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_referral_id UUID NOT NULL REFERENCES public.merchant_referrals(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_referral_id, payment_id)
);

CREATE INDEX merchant_referral_payment_credits_referral_idx
  ON public.merchant_referral_payment_credits (merchant_referral_id, currency, created_at DESC);

CREATE TABLE public.referral_attributions (
  merchant_id UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('direct', 'merchant_referral', 'developer_referral', 'ambassador_promo')),
  developer_connection_id UUID UNIQUE REFERENCES public.developer_merchant_connections(id) ON DELETE SET NULL,
  ambassador_id UUID REFERENCES public.ambassador_accounts(id) ON DELETE SET NULL,
  merchant_referral_id UUID UNIQUE REFERENCES public.merchant_referrals(id) ON DELETE SET NULL,
  source_reference TEXT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CHECK (
    (source_type = 'direct' AND developer_connection_id IS NULL AND ambassador_id IS NULL AND merchant_referral_id IS NULL)
    OR (source_type = 'developer_referral' AND developer_connection_id IS NOT NULL AND ambassador_id IS NULL AND merchant_referral_id IS NULL)
    OR (source_type = 'ambassador_promo' AND developer_connection_id IS NULL AND ambassador_id IS NOT NULL AND merchant_referral_id IS NULL)
    OR (source_type = 'merchant_referral' AND developer_connection_id IS NULL AND ambassador_id IS NULL AND merchant_referral_id IS NOT NULL)
  )
);

CREATE TABLE public.partner_commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('developer', 'ambassador', 'merchant_referral')),
  developer_id UUID REFERENCES public.developer_accounts(id) ON DELETE RESTRICT,
  ambassador_id UUID REFERENCES public.ambassador_accounts(id) ON DELETE RESTRICT,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE RESTRICT,
  source_merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  source_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  source_subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('developer_transaction_commission', 'developer_activation_bonus', 'ambassador_plan_reward', 'merchant_referral_reward', 'adjustment', 'reversal')),
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'paid', 'reversed')),
  available_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (beneficiary_type = 'developer' AND developer_id IS NOT NULL AND ambassador_id IS NULL AND merchant_id IS NULL)
    OR (beneficiary_type = 'ambassador' AND developer_id IS NULL AND ambassador_id IS NOT NULL AND merchant_id IS NULL)
    OR (beneficiary_type = 'merchant_referral' AND developer_id IS NULL AND ambassador_id IS NULL AND merchant_id IS NOT NULL)
  )
);

CREATE INDEX partner_commission_beneficiary_status_idx
  ON public.partner_commission_ledger (beneficiary_type, status, created_at DESC);
CREATE INDEX partner_commission_developer_idx
  ON public.partner_commission_ledger (developer_id, created_at DESC) WHERE developer_id IS NOT NULL;
CREATE INDEX partner_commission_ambassador_idx
  ON public.partner_commission_ledger (ambassador_id, created_at DESC) WHERE ambassador_id IS NOT NULL;
CREATE INDEX partner_commission_merchant_idx
  ON public.partner_commission_ledger (merchant_id, created_at DESC) WHERE merchant_id IS NOT NULL;
CREATE INDEX partner_commission_source_payment_idx
  ON public.partner_commission_ledger (source_payment_id) WHERE source_payment_id IS NOT NULL;

CREATE TABLE public.partner_withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('developer', 'ambassador', 'merchant_referral')),
  developer_id UUID REFERENCES public.developer_accounts(id) ON DELETE RESTRICT,
  ambassador_id UUID REFERENCES public.ambassador_accounts(id) ON DELETE RESTRICT,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE RESTRICT,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  fees NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (fees >= 0),
  total NUMERIC(15, 2) NOT NULL CHECK (total > 0),
  currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
  destination_type TEXT NOT NULL,
  destination_masked TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE,
  failure_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  CHECK (total = amount + fees),
  CHECK (
    (beneficiary_type = 'developer' AND developer_id IS NOT NULL AND ambassador_id IS NULL AND merchant_id IS NULL)
    OR (beneficiary_type = 'ambassador' AND developer_id IS NULL AND ambassador_id IS NOT NULL AND merchant_id IS NULL)
    OR (beneficiary_type = 'merchant_referral' AND developer_id IS NULL AND ambassador_id IS NULL AND merchant_id IS NOT NULL)
  )
);

CREATE INDEX partner_withdrawals_status_idx
  ON public.partner_withdrawals (status, requested_at DESC);

CREATE TABLE public.partner_monthly_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  beneficiary_type TEXT NOT NULL CHECK (beneficiary_type IN ('developer', 'ambassador', 'merchant_referral')),
  beneficiary_id UUID NOT NULL,
  statement_month DATE NOT NULL,
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  earned_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  reversed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  withdrawn_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed')),
  closed_at TIMESTAMPTZ,
  snapshot JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (beneficiary_type, beneficiary_id, statement_month, currency),
  CHECK (statement_month = DATE_TRUNC('month', statement_month)::DATE)
);

CREATE TABLE public.platform_monthly_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_month DATE NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'closed')),
  totals JSONB NOT NULL DEFAULT '{}'::JSONB,
  merchant_breakdown JSONB NOT NULL DEFAULT '[]'::JSONB,
  partner_breakdown JSONB NOT NULL DEFAULT '[]'::JSONB,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (report_month = DATE_TRUNC('month', report_month)::DATE)
);

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS created_by_type TEXT NOT NULL DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS developer_id UUID REFERENCES public.developer_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS developer_connection_id UUID REFERENCES public.developer_merchant_connections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] NOT NULL DEFAULT ARRAY['payments:create', 'payments:read', 'withdrawals:create']::TEXT[];

ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_created_by_type_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_created_by_type_check
  CHECK (created_by_type IN ('merchant', 'developer', 'system'));
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_developer_origin_check;
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_developer_origin_check
  CHECK (
    (created_by_type = 'developer' AND developer_id IS NOT NULL AND developer_connection_id IS NOT NULL AND scopes <@ ARRAY['payments:create', 'withdrawals:create']::TEXT[])
    OR created_by_type <> 'developer'
  );

CREATE INDEX IF NOT EXISTS api_keys_developer_connection_idx
  ON public.api_keys (developer_connection_id, revoked_at)
  WHERE developer_connection_id IS NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS api_key_origin TEXT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_api_key_origin_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_api_key_origin_check
  CHECK (api_key_origin IS NULL OR api_key_origin IN ('merchant', 'developer', 'system'));

CREATE INDEX IF NOT EXISTS payments_api_key_id_status_idx
  ON public.payments (api_key_id, status, created_at DESC)
  WHERE api_key_id IS NOT NULL;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.reserve_developer_payment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_connection public.developer_merchant_connections%ROWTYPE;
  v_currency TEXT := UPPER(COALESCE(NEW.currency, 'HTG'));
BEGIN
  IF NEW.api_key_origin IS DISTINCT FROM 'developer' THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('failed', 'expired', 'cancelled') THEN
    RETURN NEW;
  END IF;

  SELECT connection.*
  INTO v_connection
  FROM public.api_keys api_key
  JOIN public.developer_merchant_connections connection
    ON connection.id = api_key.developer_connection_id
  WHERE api_key.id = NEW.api_key_id
    AND api_key.merchant_id = NEW.merchant_id
    AND api_key.created_by_type = 'developer'
    AND api_key.revoked_at IS NULL
  FOR UPDATE OF connection;

  IF NOT FOUND OR v_connection.status = 'revoked' THEN
    RAISE EXCEPTION 'developer_connection_inactive' USING ERRCODE = '42501';
  END IF;

  -- The integration ceiling no longer applies once a merchant has moved Live
  -- with a payment created by its own API key.
  IF v_connection.status = 'live' THEN
    RETURN NEW;
  END IF;

  IF v_currency = 'HTG' THEN
    IF v_connection.integration_htg_total + NEW.amount > 7000 THEN
      RAISE EXCEPTION 'developer_integration_limit_reached:HTG:%:%',
        v_connection.integration_htg_total,
        7000
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.developer_merchant_connections
    SET integration_htg_total = integration_htg_total + NEW.amount,
        status = 'integration'
    WHERE id = v_connection.id;
  ELSIF v_currency = 'USD' THEN
    IF v_connection.integration_usd_total + NEW.amount > 55 THEN
      RAISE EXCEPTION 'developer_integration_limit_reached:USD:%:%',
        v_connection.integration_usd_total,
        55
        USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.developer_merchant_connections
    SET integration_usd_total = integration_usd_total + NEW.amount,
        status = 'integration'
    WHERE id = v_connection.id;
  ELSE
    RAISE EXCEPTION 'developer_integration_currency_unsupported:%', v_currency
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.release_developer_payment_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_currency TEXT := UPPER(COALESCE(OLD.currency, 'HTG'));
  v_connection_id UUID;
BEGIN
  IF OLD.api_key_origin IS DISTINCT FROM 'developer' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('failed', 'expired', 'cancelled')
       OR NEW.status NOT IN ('failed', 'expired', 'cancelled') THEN
      RETURN NEW;
    END IF;
  ELSIF OLD.status IN ('failed', 'expired', 'cancelled') THEN
    RETURN OLD;
  END IF;

  SELECT developer_connection_id
  INTO v_connection_id
  FROM public.api_keys
  WHERE id = OLD.api_key_id;

  IF v_connection_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF v_currency = 'HTG' THEN
    UPDATE public.developer_merchant_connections
    SET integration_htg_total = GREATEST(0, integration_htg_total - OLD.amount)
    WHERE id = v_connection_id AND status <> 'live';
  ELSIF v_currency = 'USD' THEN
    UPDATE public.developer_merchant_connections
    SET integration_usd_total = GREATEST(0, integration_usd_total - OLD.amount)
    WHERE id = v_connection_id AND status <> 'live';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.reserve_developer_payment_capacity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.release_developer_payment_capacity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reserve_developer_payment_capacity ON public.payments;
CREATE TRIGGER reserve_developer_payment_capacity
  BEFORE INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.reserve_developer_payment_capacity();

DROP TRIGGER IF EXISTS release_developer_payment_capacity_on_update ON public.payments;
CREATE TRIGGER release_developer_payment_capacity_on_update
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.release_developer_payment_capacity();

DROP TRIGGER IF EXISTS release_developer_payment_capacity_on_delete ON public.payments;
CREATE TRIGGER release_developer_payment_capacity_on_delete
  AFTER DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION private.release_developer_payment_capacity();

CREATE INDEX IF NOT EXISTS developer_connections_developer_status_idx
  ON public.developer_merchant_connections (developer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS developer_connections_merchant_status_idx
  ON public.developer_merchant_connections (merchant_id, status);
CREATE INDEX IF NOT EXISTS merchant_referrals_referrer_status_idx
  ON public.merchant_referrals (referrer_merchant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS referral_attributions_source_idx
  ON public.referral_attributions (source_type, attributed_at DESC);

DROP TRIGGER IF EXISTS update_developer_accounts_modtime ON public.developer_accounts;
CREATE TRIGGER update_developer_accounts_modtime
  BEFORE UPDATE ON public.developer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_developer_invitations_modtime ON public.developer_invitations;
CREATE TRIGGER update_developer_invitations_modtime
  BEFORE UPDATE ON public.developer_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_developer_connections_modtime ON public.developer_merchant_connections;
CREATE TRIGGER update_developer_connections_modtime
  BEFORE UPDATE ON public.developer_merchant_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_ambassador_accounts_modtime ON public.ambassador_accounts;
CREATE TRIGGER update_ambassador_accounts_modtime
  BEFORE UPDATE ON public.ambassador_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_partner_applications_modtime ON public.partner_applications;
CREATE TRIGGER update_partner_applications_modtime
  BEFORE UPDATE ON public.partner_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_merchant_referrals_modtime ON public.merchant_referrals;
CREATE TRIGGER update_merchant_referrals_modtime
  BEFORE UPDATE ON public.merchant_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_partner_statements_modtime ON public.partner_monthly_statements;
CREATE TRIGGER update_partner_statements_modtime
  BEFORE UPDATE ON public.partner_monthly_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_platform_reports_modtime ON public.platform_monthly_reports;
CREATE TRIGGER update_platform_reports_modtime
  BEFORE UPDATE ON public.platform_monthly_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.developer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_merchant_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_referral_payment_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_monthly_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_monthly_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.developer_accounts,
  public.developer_invitations,
  public.developer_merchant_connections,
  public.ambassador_accounts,
  public.partner_applications,
  public.merchant_referrals,
  public.merchant_referral_payment_credits,
  public.referral_attributions,
  public.partner_commission_ledger,
  public.partner_withdrawals,
  public.partner_monthly_statements,
  public.platform_monthly_reports
FROM anon, authenticated;

GRANT ALL ON TABLE
  public.developer_accounts,
  public.developer_invitations,
  public.developer_merchant_connections,
  public.ambassador_accounts,
  public.partner_applications,
  public.merchant_referrals,
  public.merchant_referral_payment_credits,
  public.referral_attributions,
  public.partner_commission_ledger,
  public.partner_withdrawals,
  public.partner_monthly_statements,
  public.platform_monthly_reports
TO service_role;

COMMENT ON TABLE public.developer_accounts IS 'Admin-activated Kobara Developer profiles.';
COMMENT ON TABLE public.developer_merchant_connections IS 'Delegated Developer access to one merchant with integration limits.';
COMMENT ON TABLE public.ambassador_accounts IS 'Private, admin-created Kobara Ambassador profiles.';
COMMENT ON TABLE public.merchant_referral_payment_credits IS 'Idempotent confirmed-payment credits used to qualify merchant referrals.';
COMMENT ON TABLE public.referral_attributions IS 'Immutable initial acquisition source for each merchant.';
COMMENT ON TABLE public.partner_commission_ledger IS 'Idempotent financial ledger for all partner earnings and reversals.';
COMMENT ON COLUMN public.api_keys.scopes IS 'Server-enforced API capabilities assigned to this key.';
COMMENT ON COLUMN public.payments.api_key_origin IS 'Creator class of the API key that originated this payment.';
