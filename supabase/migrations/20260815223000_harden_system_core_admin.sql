BEGIN;

-- Canonical administrator identity used by the system-core session.
ALTER TABLE public.super_admins
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'super_admin',
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE public.super_admins DROP CONSTRAINT IF EXISTS super_admins_role_check;
ALTER TABLE public.super_admins
  ADD CONSTRAINT super_admins_role_check
  CHECK (role IN ('super_admin', 'operations', 'compliance', 'support'));

ALTER TABLE public.admin_otps
  ADD COLUMN IF NOT EXISTS code_hash TEXT,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.admin_otps ALTER COLUMN code DROP NOT NULL;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS admin_id UUID;
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_admin_id_fkey;
ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES public.super_admins(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created
  ON public.audit_logs (admin_id, created_at DESC);

-- Move administrator foreign keys away from the unrelated merchant users table.
UPDATE public.legal_documents d SET uploaded_by = NULL
WHERE uploaded_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = d.uploaded_by);
UPDATE public.ai_derived_rules r SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = r.reviewed_by);
UPDATE public.kyc_profiles k SET reviewed_by = NULL
WHERE reviewed_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = k.reviewed_by);
UPDATE public.risk_alerts r SET resolved_by = NULL
WHERE resolved_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = r.resolved_by);
UPDATE public.merchant_restrictions r SET applied_by = NULL
WHERE applied_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = r.applied_by);
UPDATE public.merchant_restrictions r SET lifted_by = NULL
WHERE lifted_by IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = r.lifted_by);

ALTER TABLE public.legal_documents DROP CONSTRAINT IF EXISTS legal_documents_uploaded_by_fkey;
ALTER TABLE public.legal_documents ADD CONSTRAINT legal_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.ai_derived_rules DROP CONSTRAINT IF EXISTS ai_derived_rules_reviewed_by_fkey;
ALTER TABLE public.ai_derived_rules ADD CONSTRAINT ai_derived_rules_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.kyc_profiles DROP CONSTRAINT IF EXISTS kyc_profiles_reviewed_by_fkey;
ALTER TABLE public.kyc_profiles ADD CONSTRAINT kyc_profiles_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.risk_alerts DROP CONSTRAINT IF EXISTS risk_alerts_resolved_by_fkey;
ALTER TABLE public.risk_alerts ADD CONSTRAINT risk_alerts_resolved_by_fkey
  FOREIGN KEY (resolved_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.merchant_restrictions DROP CONSTRAINT IF EXISTS merchant_restrictions_applied_by_fkey;
ALTER TABLE public.merchant_restrictions ADD CONSTRAINT merchant_restrictions_applied_by_fkey
  FOREIGN KEY (applied_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;
ALTER TABLE public.merchant_restrictions DROP CONSTRAINT IF EXISTS merchant_restrictions_lifted_by_fkey;
ALTER TABLE public.merchant_restrictions ADD CONSTRAINT merchant_restrictions_lifted_by_fkey
  FOREIGN KEY (lifted_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;

-- Consolidate the second audit table into the canonical audit log.
INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, ip_address, metadata, created_at)
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM public.super_admins a WHERE a.id = l.admin_id) THEN l.admin_id ELSE NULL END,
  l.action,
  l.target_table,
  l.target_id,
  l.ip_address,
  jsonb_build_object('before', l.before_state, 'after', l.after_state, 'migrated_from', 'admin_audit_logs'),
  l.created_at
FROM public.admin_audit_logs l
WHERE NOT EXISTS (
  SELECT 1 FROM public.audit_logs a
  WHERE a.action = l.action
    AND a.created_at = l.created_at
    AND a.metadata->>'migrated_from' = 'admin_audit_logs'
);

DROP TRIGGER IF EXISTS trigger_log_ai_rule_activation ON public.ai_derived_rules;
DROP FUNCTION IF EXISTS public.log_ai_rule_activation();
DROP TABLE IF EXISTS public.admin_audit_logs;

CREATE OR REPLACE FUNCTION public.log_ai_rule_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, metadata)
    VALUES (
      NEW.reviewed_by,
      'legal.rule_activated',
      'ai_derived_rules',
      NEW.id,
      jsonb_build_object('before', to_jsonb(OLD), 'after', to_jsonb(NEW))
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_log_ai_rule_activation
AFTER UPDATE OF status ON public.ai_derived_rules
FOR EACH ROW EXECUTE FUNCTION public.log_ai_rule_activation();

-- Persist support conversations instead of sending email-only tickets.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS assigned_admin_id UUID REFERENCES public.super_admins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated
  ON public.support_tickets (status, updated_at DESC);

ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Restore the mobile push device registry on environments where the earlier
-- migration was skipped.
CREATE TABLE IF NOT EXISTS public.merchant_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  device_info JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (merchant_id, expo_push_token)
);
CREATE INDEX IF NOT EXISTS idx_merchant_devices_merchant
  ON public.merchant_devices (merchant_id, last_active_at DESC);
ALTER TABLE public.merchant_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Merchants can manage their own devices" ON public.merchant_devices;
CREATE POLICY "Merchants can manage their own devices"
  ON public.merchant_devices
  FOR ALL
  TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL
  DEFAULT '{"payments": true, "withdrawals": true, "transfers": true, "security": true}'::JSONB;

-- A single source of truth credits normal payments exactly once.
CREATE OR REPLACE FUNCTION public.handle_payment_success()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'succeeded'
     AND NEW.status = 'succeeded'
     AND COALESCE(NEW.metadata->>'is_subscription_upgrade', 'false') <> 'true' THEN
    IF NEW.environment = 'test' THEN
      UPDATE public.merchants
      SET available_balance_test = COALESCE(available_balance_test, 0) + COALESCE(NEW.net_amount, 0),
          updated_at = NOW()
      WHERE id = NEW.merchant_id;
    ELSE
      UPDATE public.merchants
      SET available_balance = COALESCE(available_balance, 0) + COALESCE(NEW.net_amount, 0),
          updated_at = NOW()
      WHERE id = NEW.merchant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_payment_success ON public.payments;
CREATE TRIGGER on_payment_success
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.handle_payment_success();

-- Atomic and idempotent administrator withdrawal state machine.
CREATE OR REPLACE FUNCTION public.admin_manage_withdrawal(
  p_withdrawal_id UUID,
  p_action TEXT,
  p_reason TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_balance NUMERIC;
  v_is_test BOOLEAN;
BEGIN
  SELECT * INTO v_withdrawal FROM public.withdrawals
  WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal_not_found'; END IF;

  v_is_test := v_withdrawal.environment = 'test';

  IF p_action = 'approve' THEN
    IF v_withdrawal.status <> 'pending_approval' THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;
    IF v_is_test THEN
      SELECT available_balance_test INTO v_balance FROM public.merchants WHERE id = v_withdrawal.merchant_id FOR UPDATE;
      IF COALESCE(v_balance, 0) < v_withdrawal.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
      UPDATE public.merchants SET available_balance_test = available_balance_test - v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
    ELSE
      SELECT available_balance INTO v_balance FROM public.merchants WHERE id = v_withdrawal.merchant_id FOR UPDATE;
      IF COALESCE(v_balance, 0) < v_withdrawal.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
      UPDATE public.merchants SET available_balance = available_balance - v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
    END IF;
    UPDATE public.withdrawals SET status = 'completed', completed_at = NOW(), rejection_reason = NULL WHERE id = p_withdrawal_id;
  ELSIF p_action = 'reject' THEN
    IF v_withdrawal.status NOT IN ('pending', 'pending_approval') THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;
    IF v_withdrawal.status = 'pending' THEN
      IF v_is_test THEN
        UPDATE public.merchants SET available_balance_test = available_balance_test + v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
      ELSE
        UPDATE public.merchants SET available_balance = available_balance + v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
      END IF;
    END IF;
    UPDATE public.withdrawals SET status = 'rejected', completed_at = NOW(), rejection_reason = NULLIF(BTRIM(p_reason), '') WHERE id = p_withdrawal_id;
  ELSIF p_action = 'mark_paid' THEN
    IF v_withdrawal.status <> 'pending' THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;
    UPDATE public.withdrawals SET status = 'paid', completed_at = NOW() WHERE id = p_withdrawal_id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;

  INSERT INTO public.audit_logs (admin_id, merchant_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, v_withdrawal.merchant_id, 'withdrawal.' || p_action, 'withdrawals', p_withdrawal_id,
    jsonb_build_object('previous_status', v_withdrawal.status, 'reason', p_reason));

  RETURN jsonb_build_object('id', p_withdrawal_id, 'merchant_id', v_withdrawal.merchant_id,
    'amount', v_withdrawal.amount, 'total', v_withdrawal.total, 'action', p_action);
END;
$$;

-- Manual SMS reconciliation validates ownership, method, amount and state in one transaction.
CREATE OR REPLACE FUNCTION public.admin_reconcile_sms(
  p_sms_id UUID,
  p_payment_id UUID,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sms public.sms_inbox%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_sms_amount NUMERIC;
  v_trans_code TEXT;
BEGIN
  SELECT * INTO v_sms FROM public.sms_inbox WHERE id = p_sms_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sms_not_found'; END IF;

  IF v_sms.status = 'processed' AND v_sms.payment_id = p_payment_id THEN
    RETURN jsonb_build_object('payment_id', p_payment_id, 'already_processed', TRUE);
  END IF;
  IF v_sms.status NOT IN ('pending', 'failed') THEN RAISE EXCEPTION 'invalid_sms_state'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'payment_not_found'; END IF;
  IF v_payment.status NOT IN ('pending', 'failed') THEN RAISE EXCEPTION 'invalid_payment_state'; END IF;
  IF LOWER(COALESCE(v_payment.payment_method, '')) NOT LIKE '%natcash%'
     AND LOWER(COALESCE(v_payment.provider, '')) NOT LIKE '%natcash%' THEN
    RAISE EXCEPTION 'payment_method_mismatch';
  END IF;

  IF COALESCE(v_sms.parsed_json->>'amount', '') ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_sms_amount := (v_sms.parsed_json->>'amount')::NUMERIC;
    IF ABS(v_sms_amount - v_payment.amount) > 0.01 THEN RAISE EXCEPTION 'payment_amount_mismatch'; END IF;
  END IF;

  v_trans_code := NULLIF(BTRIM(v_sms.parsed_json->>'transCode'), '');
  IF v_trans_code IS NULL THEN RAISE EXCEPTION 'missing_transaction_code'; END IF;

  UPDATE public.payments
  SET status = 'succeeded', trans_code = v_trans_code, paid_at = NOW()
  WHERE id = p_payment_id;
  UPDATE public.sms_inbox
  SET status = 'processed', payment_id = p_payment_id, error_reason = NULL
  WHERE id = p_sms_id;

  INSERT INTO public.audit_logs (admin_id, merchant_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, v_payment.merchant_id, 'payment.sms_reconciled', 'payments', p_payment_id,
    jsonb_build_object('sms_id', p_sms_id, 'amount', v_payment.amount));

  RETURN jsonb_build_object('payment_id', p_payment_id, 'merchant_id', v_payment.merchant_id, 'already_processed', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_withdrawal(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reconcile_sms(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_withdrawal(UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reconcile_sms(UUID, UUID, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
