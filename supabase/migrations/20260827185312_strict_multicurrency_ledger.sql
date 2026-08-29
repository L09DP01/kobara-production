-- Strict, idempotent multi-currency accounting for merchant payments and withdrawals.

CREATE TABLE IF NOT EXISTS public.payment_balance_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'live')),
  currency TEXT NOT NULL CHECK (currency IN ('HTG', 'USD')),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  credited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_balance_entries_merchant
  ON public.payment_balance_entries (merchant_id, environment, currency, credited_at DESC);

ALTER TABLE public.payment_balance_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_balance_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.payment_balance_entries TO service_role;

-- Register already-accounted successful payments without changing balances. This
-- prevents a later repeated callback from crediting a legacy payment again.
INSERT INTO public.payment_balance_entries (
  payment_id, merchant_id, environment, currency, amount, credited_at
)
SELECT
  p.id,
  p.merchant_id,
  CASE WHEN p.environment = 'test' THEN 'test' ELSE 'live' END,
  CASE
    WHEN LOWER(COALESCE(p.provider, '')) = 'paypal'
      OR LOWER(COALESCE(p.payment_source, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
      OR LOWER(COALESCE(p.payment_method, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
    THEN 'USD'
    ELSE 'HTG'
  END,
  CASE
    WHEN LOWER(COALESCE(p.provider, '')) = 'paypal'
      OR LOWER(COALESCE(p.payment_source, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
      OR LOWER(COALESCE(p.payment_method, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
    THEN p.net_amount_usd
    ELSE COALESCE(p.net_amount, p.amount)
  END,
  COALESCE(p.paid_at, p.updated_at, NOW())
FROM public.payments p
WHERE p.status IN ('succeeded', 'completed')
  AND COALESCE(p.metadata->>'is_subscription_upgrade', 'false') <> 'true'
  AND (
    (
      LOWER(COALESCE(p.provider, '')) = 'paypal'
      OR LOWER(COALESCE(p.payment_source, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
      OR LOWER(COALESCE(p.payment_method, '')) IN ('card', 'paypal', 'apple_pay', 'google_pay')
    ) AND COALESCE(p.net_amount_usd, 0) > 0
    OR
    (
      LOWER(COALESCE(p.provider, '')) IN ('moncash', 'natcash', 'paym', 'bazik')
      OR LOWER(COALESCE(p.payment_method, '')) IN ('moncash', 'moncash_ussd', 'natcash')
    ) AND COALESCE(p.net_amount, p.amount, 0) > 0
  )
ON CONFLICT (payment_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_payment_success()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_currency TEXT;
  v_amount NUMERIC(15,2);
  v_entry_id UUID;
  v_method TEXT;
  v_provider TEXT;
  v_entry public.payment_balance_entries%ROWTYPE;
BEGIN
  v_method := LOWER(COALESCE(NEW.payment_source, NEW.payment_method, ''));
  v_provider := LOWER(COALESCE(NEW.provider, ''));

  IF COALESCE(NEW.metadata->>'is_subscription_upgrade', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.status, '') NOT IN ('succeeded', 'completed')
     AND NEW.status IN ('succeeded', 'completed') THEN
    IF v_provider = 'paypal' OR v_method IN ('card', 'paypal', 'apple_pay', 'google_pay') THEN
      v_currency := 'USD';
      v_amount := NEW.net_amount_usd;
    ELSIF v_provider IN ('moncash', 'natcash', 'paym', 'bazik')
       OR v_method IN ('moncash', 'moncash_ussd', 'natcash') THEN
      v_currency := 'HTG';
      v_amount := COALESCE(NEW.net_amount, NEW.amount);
    ELSE
      -- Unknown methods are intentionally left uncredited for manual review.
      RETURN NEW;
    END IF;

    IF COALESCE(v_amount, 0) <= 0 THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.payment_balance_entries (
      payment_id, merchant_id, environment, currency, amount
    ) VALUES (
      NEW.id,
      NEW.merchant_id,
      CASE WHEN NEW.environment = 'test' THEN 'test' ELSE 'live' END,
      v_currency,
      v_amount
    )
    ON CONFLICT (payment_id) DO NOTHING
    RETURNING id INTO v_entry_id;

    IF v_entry_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF v_currency = 'USD' THEN
      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) + v_amount,
            updated_at = NOW()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance_usd = COALESCE(available_balance_usd, 0) + v_amount,
            updated_at = NOW()
        WHERE id = NEW.merchant_id;
      END IF;
    ELSE
      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET available_balance_test = COALESCE(available_balance_test, 0) + v_amount,
            updated_at = NOW()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET available_balance = COALESCE(available_balance, 0) + v_amount,
            updated_at = NOW()
        WHERE id = NEW.merchant_id;
      END IF;
    END IF;

  ELSIF OLD.status IN ('succeeded', 'completed') AND NEW.status = 'refunded' THEN
    SELECT * INTO v_entry
    FROM public.payment_balance_entries
    WHERE payment_id = NEW.id
    FOR UPDATE;

    IF NOT FOUND OR v_entry.reversed_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF v_entry.currency = 'USD' THEN
      IF v_entry.environment = 'test' THEN
        UPDATE public.merchants SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) - v_entry.amount, updated_at = NOW() WHERE id = v_entry.merchant_id;
      ELSE
        UPDATE public.merchants SET available_balance_usd = COALESCE(available_balance_usd, 0) - v_entry.amount, updated_at = NOW() WHERE id = v_entry.merchant_id;
      END IF;
    ELSE
      IF v_entry.environment = 'test' THEN
        UPDATE public.merchants SET available_balance_test = COALESCE(available_balance_test, 0) - v_entry.amount, updated_at = NOW() WHERE id = v_entry.merchant_id;
      ELSE
        UPDATE public.merchants SET available_balance = COALESCE(available_balance, 0) - v_entry.amount, updated_at = NOW() WHERE id = v_entry.merchant_id;
      END IF;
    END IF;

    UPDATE public.payment_balance_entries SET reversed_at = NOW() WHERE id = v_entry.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_payment_success() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_payment_success() TO service_role;

DROP TRIGGER IF EXISTS on_payment_success ON public.payments;
CREATE TRIGGER on_payment_success
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.handle_payment_success();

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'HTG',
  ADD COLUMN IF NOT EXISTS payout_currency TEXT NOT NULL DEFAULT 'HTG',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS balance_reserved_at TIMESTAMPTZ;

UPDATE public.withdrawals
SET payout_currency = COALESCE(payout_currency, currency, 'HTG'),
    exchange_rate = COALESCE(exchange_rate, 1),
    payout_amount = COALESCE(payout_amount, amount)
WHERE payout_amount IS NULL;

ALTER TABLE public.withdrawals ALTER COLUMN payout_amount SET NOT NULL;

ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_currency_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_currency_check CHECK (currency IN ('HTG', 'USD'));
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_payout_currency_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_payout_currency_check CHECK (payout_currency IN ('HTG', 'USD'));
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_exchange_rate_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_exchange_rate_check CHECK (exchange_rate > 0);
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_payout_amount_check;
-- Legacy rows may contain a zero amount. New withdrawals remain strictly
-- positive because prepare_automatic_withdrawal rejects values <= 0.
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_payout_amount_check CHECK (payout_amount >= 0);

CREATE OR REPLACE FUNCTION public.prepare_automatic_withdrawal(
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_fees NUMERIC,
  p_total NUMERIC,
  p_method TEXT,
  p_provider TEXT,
  p_wallet TEXT,
  p_reference TEXT,
  p_environment TEXT,
  p_source_currency TEXT,
  p_payout_currency TEXT,
  p_exchange_rate NUMERIC,
  p_payout_amount NUMERIC,
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Retrait Kobara'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_merchant public.merchants%ROWTYPE;
  v_balance NUMERIC;
  v_is_test BOOLEAN;
  v_currency TEXT;
  v_method TEXT;
  v_existing public.withdrawals%ROWTYPE;
  v_inserted public.withdrawals%ROWTYPE;
  v_initial_status TEXT;
BEGIN
  v_method := LOWER(BTRIM(COALESCE(p_method, '')));
  v_currency := UPPER(BTRIM(COALESCE(p_source_currency, '')));

  IF v_currency NOT IN ('HTG', 'USD') OR UPPER(BTRIM(COALESCE(p_payout_currency, ''))) NOT IN ('HTG', 'USD') THEN
    RETURN jsonb_build_object('success', false, 'error', 'unsupported_currency', 'message', 'Devise de retrait non supportée.');
  END IF;
  IF COALESCE(p_exchange_rate, 0) <= 0 OR COALESCE(p_payout_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_conversion', 'message', 'Conversion de retrait invalide.');
  END IF;

  IF p_idempotency_key IS NOT NULL AND BTRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing FROM public.withdrawals
    WHERE merchant_id = p_merchant_id AND idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'already_exists', true, 'withdrawal', row_to_json(v_existing));
    END IF;
  END IF;

  SELECT * INTO v_merchant FROM public.merchants WHERE id = p_merchant_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'merchant_not_found', 'message', 'Marchand introuvable.');
  END IF;

  v_is_test := p_environment = 'test';
  IF v_currency = 'USD' THEN
    v_balance := CASE WHEN v_is_test THEN COALESCE(v_merchant.available_balance_usd_test, 0) ELSE COALESCE(v_merchant.available_balance_usd, 0) END;
  ELSE
    v_balance := CASE WHEN v_is_test THEN COALESCE(v_merchant.available_balance_test, 0) ELSE COALESCE(v_merchant.available_balance, 0) END;
  END IF;

  IF p_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount', 'message', 'Montant invalide.');
  END IF;
  IF v_balance < p_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'message', 'Fonds insuffisants pour ce retrait.');
  END IF;

  v_initial_status := CASE WHEN v_method IN ('zelle', 'paypal') THEN 'pending_approval' ELSE 'pending' END;

  IF v_currency = 'USD' THEN
    IF v_is_test THEN
      UPDATE public.merchants SET available_balance_usd_test = available_balance_usd_test - p_total, updated_at = NOW() WHERE id = p_merchant_id;
    ELSE
      UPDATE public.merchants SET available_balance_usd = available_balance_usd - p_total, updated_at = NOW() WHERE id = p_merchant_id;
    END IF;
  ELSE
    IF v_is_test THEN
      UPDATE public.merchants SET available_balance_test = available_balance_test - p_total, updated_at = NOW() WHERE id = p_merchant_id;
    ELSE
      UPDATE public.merchants SET available_balance = available_balance - p_total, updated_at = NOW() WHERE id = p_merchant_id;
    END IF;
  END IF;

  INSERT INTO public.withdrawals (
    merchant_id, kobara_reference, amount, fees, total, wallet, description,
    status, provider, environment, idempotency_key, currency, payout_currency,
    exchange_rate, payout_amount, balance_reserved_at,
    created_at, updated_at
  ) VALUES (
    p_merchant_id, p_reference, p_amount, p_fees, p_total, p_wallet, p_description,
    v_initial_status, LOWER(p_provider), p_environment, NULLIF(BTRIM(p_idempotency_key), ''),
    v_currency, UPPER(p_payout_currency), p_exchange_rate, p_payout_amount,
    NOW(), NOW(), NOW()
  ) RETURNING * INTO v_inserted;

  RETURN jsonb_build_object('success', true, 'already_exists', false, 'withdrawal', row_to_json(v_inserted));
END;
$$;

-- Backward-compatible entry point for older deployments. New code uses the
-- extended overload above and explicitly chooses the account to debit.
CREATE OR REPLACE FUNCTION public.prepare_automatic_withdrawal(
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_fees NUMERIC,
  p_total NUMERIC,
  p_method TEXT,
  p_provider TEXT,
  p_wallet TEXT,
  p_reference TEXT,
  p_environment TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Retrait Kobara'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_currency TEXT;
BEGIN
  v_currency := CASE WHEN LOWER(BTRIM(COALESCE(p_method, ''))) IN ('zelle', 'paypal') THEN 'USD' ELSE 'HTG' END;
  RETURN public.prepare_automatic_withdrawal(
    p_merchant_id, p_amount, p_fees, p_total, p_method, p_provider,
    p_wallet, p_reference, p_environment, v_currency, v_currency, 1,
    p_amount, p_idempotency_key, p_description
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_and_refund_withdrawal(
  p_withdrawal_id UUID,
  p_reason TEXT DEFAULT 'Transfer failed',
  p_provider_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_updated public.withdrawals%ROWTYPE;
  v_is_test BOOLEAN;
  v_refunded BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'withdrawal_not_found'); END IF;
  IF v_withdrawal.status IN ('failed', 'rejected') OR v_withdrawal.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_refunded', true, 'withdrawal', row_to_json(v_withdrawal));
  END IF;
  IF v_withdrawal.status IN ('completed', 'paid') THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_refund_completed_withdrawal', 'current_status', v_withdrawal.status);
  END IF;

  v_is_test := v_withdrawal.environment = 'test';
  IF v_withdrawal.balance_reserved_at IS NOT NULL THEN
    PERFORM 1 FROM public.merchants WHERE id = v_withdrawal.merchant_id FOR UPDATE;
    IF v_withdrawal.currency = 'USD' THEN
      IF v_is_test THEN
        UPDATE public.merchants SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) + v_withdrawal.total, updated_at = NOW() WHERE id = v_withdrawal.merchant_id;
      ELSE
        UPDATE public.merchants SET available_balance_usd = COALESCE(available_balance_usd, 0) + v_withdrawal.total, updated_at = NOW() WHERE id = v_withdrawal.merchant_id;
      END IF;
    ELSE
      IF v_is_test THEN
        UPDATE public.merchants SET available_balance_test = COALESCE(available_balance_test, 0) + v_withdrawal.total, updated_at = NOW() WHERE id = v_withdrawal.merchant_id;
      ELSE
        UPDATE public.merchants SET available_balance = COALESCE(available_balance, 0) + v_withdrawal.total, updated_at = NOW() WHERE id = v_withdrawal.merchant_id;
      END IF;
    END IF;
    v_refunded := TRUE;
  END IF;

  UPDATE public.withdrawals
  SET status = 'failed', failed_reason = p_reason, refunded_at = NOW(), completed_at = NOW(),
      provider_response = COALESCE(p_provider_response, provider_response), updated_at = NOW()
  WHERE id = p_withdrawal_id RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'refunded', v_refunded, 'amount_refunded', CASE WHEN v_refunded THEN v_withdrawal.total ELSE 0 END, 'withdrawal', row_to_json(v_updated));
END;
$$;

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
  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'withdrawal_not_found'; END IF;
  v_is_test := v_withdrawal.environment = 'test';

  IF p_action = 'approve' THEN
    IF v_withdrawal.status <> 'pending_approval' THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;

    -- Legacy pending approvals were not reserved. Reserve exactly once before approval.
    IF v_withdrawal.balance_reserved_at IS NULL THEN
      IF v_withdrawal.currency = 'USD' THEN
        SELECT CASE WHEN v_is_test THEN available_balance_usd_test ELSE available_balance_usd END INTO v_balance FROM public.merchants WHERE id = v_withdrawal.merchant_id FOR UPDATE;
        IF COALESCE(v_balance, 0) < v_withdrawal.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
        IF v_is_test THEN UPDATE public.merchants SET available_balance_usd_test = available_balance_usd_test - v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
        ELSE UPDATE public.merchants SET available_balance_usd = available_balance_usd - v_withdrawal.total WHERE id = v_withdrawal.merchant_id; END IF;
      ELSE
        SELECT CASE WHEN v_is_test THEN available_balance_test ELSE available_balance END INTO v_balance FROM public.merchants WHERE id = v_withdrawal.merchant_id FOR UPDATE;
        IF COALESCE(v_balance, 0) < v_withdrawal.total THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
        IF v_is_test THEN UPDATE public.merchants SET available_balance_test = available_balance_test - v_withdrawal.total WHERE id = v_withdrawal.merchant_id;
        ELSE UPDATE public.merchants SET available_balance = available_balance - v_withdrawal.total WHERE id = v_withdrawal.merchant_id; END IF;
      END IF;
    END IF;

    UPDATE public.withdrawals
    SET status = 'pending', balance_reserved_at = COALESCE(balance_reserved_at, NOW()),
        completed_at = NULL, rejection_reason = NULL, updated_at = NOW()
    WHERE id = p_withdrawal_id;
  ELSIF p_action = 'reject' THEN
    IF v_withdrawal.status NOT IN ('pending', 'pending_approval', 'processing') THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;
    PERFORM public.fail_and_refund_withdrawal(p_withdrawal_id, COALESCE(NULLIF(BTRIM(p_reason), ''), 'Retrait refusé'), NULL);
    UPDATE public.withdrawals SET status = 'rejected', rejection_reason = NULLIF(BTRIM(p_reason), ''), updated_at = NOW() WHERE id = p_withdrawal_id;
  ELSIF p_action = 'mark_paid' THEN
    IF v_withdrawal.status NOT IN ('pending', 'processing') THEN RAISE EXCEPTION 'invalid_withdrawal_state'; END IF;
    UPDATE public.withdrawals SET status = 'paid', completed_at = NOW(), updated_at = NOW() WHERE id = p_withdrawal_id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;

  INSERT INTO public.audit_logs (admin_id, merchant_id, action, entity_type, entity_id, metadata)
  VALUES (p_admin_id, v_withdrawal.merchant_id, 'withdrawal.' || p_action, 'withdrawals', p_withdrawal_id,
    jsonb_build_object('previous_status', v_withdrawal.status, 'currency', v_withdrawal.currency, 'reason', p_reason));

  RETURN jsonb_build_object(
    'id', p_withdrawal_id,
    'merchant_id', v_withdrawal.merchant_id,
    'amount', v_withdrawal.amount,
    'currency', v_withdrawal.currency,
    'payout_amount', v_withdrawal.payout_amount,
    'payout_currency', v_withdrawal.payout_currency,
    'exchange_rate', v_withdrawal.exchange_rate,
    'total', v_withdrawal.total,
    'action', p_action
  );
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.fail_and_refund_withdrawal(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_and_refund_withdrawal(UUID, TEXT, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.admin_manage_withdrawal(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_withdrawal(UUID, TEXT, TEXT, UUID) TO service_role;
