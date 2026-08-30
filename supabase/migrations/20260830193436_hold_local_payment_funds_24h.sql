-- Hold local payment proceeds for 24 hours while keeping them visible in the
-- merchant's total balance. Historical credits remain immediately available.

ALTER TABLE public.payment_balance_entries
  ADD COLUMN IF NOT EXISTS withdrawable_at TIMESTAMPTZ;

UPDATE public.payment_balance_entries
SET withdrawable_at = credited_at
WHERE withdrawable_at IS NULL;

-- Apply the policy to local payments received during the previous 24 hours.
UPDATE public.payment_balance_entries e
SET withdrawable_at = e.credited_at + INTERVAL '24 hours'
FROM public.payments p
WHERE p.id = e.payment_id
  AND e.currency = 'HTG'
  AND e.reversed_at IS NULL
  AND e.credited_at > NOW() - INTERVAL '24 hours'
  AND (
    LOWER(COALESCE(p.provider, '')) IN ('moncash', 'natcash', 'paym', 'bazik', 'sms_gateway')
    OR LOWER(COALESCE(NULLIF(p.payment_source, ''), p.payment_method, '')) IN ('moncash', 'moncash_ussd', 'natcash')
  );

ALTER TABLE public.payment_balance_entries
  ALTER COLUMN withdrawable_at SET DEFAULT NOW(),
  ALTER COLUMN withdrawable_at SET NOT NULL;

ALTER TABLE public.payment_balance_entries
  DROP CONSTRAINT IF EXISTS payment_balance_entries_withdrawable_at_check;
ALTER TABLE public.payment_balance_entries
  ADD CONSTRAINT payment_balance_entries_withdrawable_at_check
  CHECK (withdrawable_at >= credited_at);

CREATE INDEX IF NOT EXISTS idx_payment_balance_entries_pending_release
  ON public.payment_balance_entries (merchant_id, environment, currency, withdrawable_at)
  WHERE reversed_at IS NULL;

CREATE OR REPLACE FUNCTION public.get_merchant_funds_availability(
  p_merchant_id UUID,
  p_environment TEXT DEFAULT 'live',
  p_currency TEXT DEFAULT 'HTG'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_environment TEXT;
  v_currency TEXT;
  v_total NUMERIC(15,2);
  v_raw_held NUMERIC(15,2);
  v_held NUMERIC(15,2);
  v_next_release TIMESTAMPTZ;
BEGIN
  v_environment := CASE WHEN LOWER(BTRIM(COALESCE(p_environment, ''))) = 'test' THEN 'test' ELSE 'live' END;
  v_currency := UPPER(BTRIM(COALESCE(p_currency, '')));

  IF v_currency NOT IN ('HTG', 'USD') THEN
    RAISE EXCEPTION 'unsupported_currency';
  END IF;

  SELECT CASE
    WHEN v_currency = 'USD' AND v_environment = 'test' THEN COALESCE(m.available_balance_usd_test, 0)
    WHEN v_currency = 'USD' THEN COALESCE(m.available_balance_usd, 0)
    WHEN v_environment = 'test' THEN COALESCE(m.available_balance_test, 0)
    ELSE COALESCE(m.available_balance, 0)
  END
  INTO v_total
  FROM public.merchants m
  WHERE m.id = p_merchant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found';
  END IF;

  SELECT COALESCE(SUM(e.amount), 0), MIN(e.withdrawable_at)
  INTO v_raw_held, v_next_release
  FROM public.payment_balance_entries e
  WHERE e.merchant_id = p_merchant_id
    AND e.environment = v_environment
    AND e.currency = v_currency
    AND e.reversed_at IS NULL
    AND e.withdrawable_at > NOW();

  v_total := GREATEST(COALESCE(v_total, 0), 0);
  v_raw_held := GREATEST(COALESCE(v_raw_held, 0), 0);
  v_held := LEAST(v_total, v_raw_held);

  RETURN jsonb_build_object(
    'currency', v_currency,
    'environment', v_environment,
    'total_balance', v_total,
    'withdrawable_balance', GREATEST(v_total - v_held, 0),
    'pending_release_balance', v_held,
    'raw_pending_release_balance', v_raw_held,
    'next_release_at', v_next_release,
    'hold_hours', CASE WHEN v_currency = 'HTG' THEN 24 ELSE 0 END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_merchant_funds_availability(UUID, TEXT, TEXT) TO service_role;

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
  v_withdrawable_at TIMESTAMPTZ;
  v_entry public.payment_balance_entries%ROWTYPE;
BEGIN
  v_method := LOWER(COALESCE(NULLIF(NEW.payment_source, ''), NEW.payment_method, ''));
  v_provider := LOWER(COALESCE(NEW.provider, ''));

  IF COALESCE(NEW.metadata->>'is_subscription_upgrade', 'false') = 'true' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.status, '') NOT IN ('succeeded', 'completed')
     AND NEW.status IN ('succeeded', 'completed') THEN
    IF v_provider = 'paypal' OR v_method IN ('card', 'paypal', 'apple_pay', 'google_pay') THEN
      v_currency := 'USD';
      v_amount := NEW.net_amount_usd;
    ELSIF v_provider IN ('moncash', 'natcash', 'paym', 'bazik', 'sms_gateway')
       OR v_method IN ('moncash', 'moncash_ussd', 'natcash') THEN
      v_currency := 'HTG';
      v_amount := COALESCE(NEW.net_amount, NEW.amount);
    ELSE
      RETURN NEW;
    END IF;

    IF COALESCE(v_amount, 0) <= 0 THEN
      RETURN NEW;
    END IF;

    v_withdrawable_at := CASE
      WHEN v_currency = 'HTG' THEN NOW() + INTERVAL '24 hours'
      ELSE NOW()
    END;

    INSERT INTO public.payment_balance_entries (
      payment_id, merchant_id, environment, currency, amount, withdrawable_at
    ) VALUES (
      NEW.id,
      NEW.merchant_id,
      CASE WHEN NEW.environment = 'test' THEN 'test' ELSE 'live' END,
      v_currency,
      v_amount,
      v_withdrawable_at
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

-- The aggregate balance is reserved before the withdrawal row is inserted.
-- Raising from this trigger rolls back both operations atomically.
CREATE OR REPLACE FUNCTION public.enforce_withdrawable_withdrawal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_funds JSONB;
BEGIN
  IF NEW.currency = 'HTG'
     AND NEW.balance_reserved_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.balance_reserved_at IS NULL) THEN
    v_funds := public.get_merchant_funds_availability(NEW.merchant_id, NEW.environment, NEW.currency);

    IF COALESCE((v_funds->>'total_balance')::NUMERIC, 0)
       < COALESCE((v_funds->>'raw_pending_release_balance')::NUMERIC, 0) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'local_funds_pending_release',
        DETAIL = 'Les crédits MonCash et NatCash deviennent disponibles au retrait 24 heures après leur confirmation.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_withdrawable_withdrawal_balance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_withdrawable_withdrawal_balance() TO service_role;

DROP TRIGGER IF EXISTS enforce_withdrawable_withdrawal_balance ON public.withdrawals;
CREATE TRIGGER enforce_withdrawable_withdrawal_balance
BEFORE INSERT OR UPDATE OF balance_reserved_at ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.enforce_withdrawable_withdrawal_balance();

-- B2B is an outbound movement and cannot be used to bypass the hold.
CREATE OR REPLACE FUNCTION public.process_b2b_transfer(
  p_sender_id UUID,
  p_receiver_email VARCHAR,
  p_amount DECIMAL,
  p_environment VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_receiver_id UUID;
  v_sender_balance DECIMAL;
  v_transfer_id UUID;
  v_reference VARCHAR;
  v_funds JSONB;
BEGIN
  IF COALESCE(p_amount, 0) <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Montant invalide.');
  END IF;

  SELECT id INTO v_receiver_id
  FROM public.merchants
  WHERE LOWER(email) = LOWER(BTRIM(p_receiver_email));

  IF v_receiver_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Le marchand destinataire n''existe pas.');
  END IF;
  IF v_receiver_id = p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Vous ne pouvez pas vous transférer de l''argent à vous-même.');
  END IF;

  IF p_environment = 'test' THEN
    SELECT available_balance_test INTO v_sender_balance FROM public.merchants WHERE id = p_sender_id FOR UPDATE;
  ELSE
    SELECT available_balance INTO v_sender_balance FROM public.merchants WHERE id = p_sender_id FOR UPDATE;
  END IF;

  v_funds := public.get_merchant_funds_availability(p_sender_id, p_environment, 'HTG');
  IF COALESCE((v_funds->>'withdrawable_balance')::NUMERIC, 0) < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Le solde disponible au retrait est insuffisant.',
      'code', 'FUNDS_PENDING_RELEASE',
      'withdrawable_balance', COALESCE((v_funds->>'withdrawable_balance')::NUMERIC, 0)
    );
  END IF;

  PERFORM id FROM public.merchants WHERE id = v_receiver_id FOR UPDATE;

  IF p_environment = 'test' THEN
    UPDATE public.merchants SET available_balance_test = available_balance_test - p_amount WHERE id = p_sender_id;
    UPDATE public.merchants SET available_balance_test = available_balance_test + p_amount WHERE id = v_receiver_id;
  ELSE
    UPDATE public.merchants SET available_balance = available_balance - p_amount WHERE id = p_sender_id;
    UPDATE public.merchants SET available_balance = available_balance + p_amount WHERE id = v_receiver_id;
  END IF;

  v_reference := 'B2B-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
  INSERT INTO public.b2b_transfers (sender_id, receiver_id, amount, environment, reference)
  VALUES (p_sender_id, v_receiver_id, p_amount, p_environment, v_reference)
  RETURNING id INTO v_transfer_id;

  RETURN json_build_object('success', true, 'transfer_id', v_transfer_id, 'receiver_id', v_receiver_id, 'reference', v_reference);
END;
$$;

REVOKE ALL ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR) TO service_role;
