-- Add a USD-settled crypto payment rail backed by NOWPayments.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS nowpayments_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS nowpayments_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS crypto_pay_currency TEXT,
  ADD COLUMN IF NOT EXISTS crypto_pay_amount NUMERIC(36, 18),
  ADD COLUMN IF NOT EXISTS crypto_pay_address TEXT,
  ADD COLUMN IF NOT EXISTS crypto_pay_extra_id TEXT,
  ADD COLUMN IF NOT EXISTS nowpayments_payment_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS payments_nowpayments_invoice_id_unique
  ON public.payments (nowpayments_invoice_id)
  WHERE nowpayments_invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payments_nowpayments_payment_id_unique
  ON public.payments (nowpayments_payment_id)
  WHERE nowpayments_payment_id IS NOT NULL;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_crypto_pay_currency_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_crypto_pay_currency_check CHECK (
  crypto_pay_currency IS NULL OR crypto_pay_currency IN (
    'btc', 'eth', 'trx', 'ton', 'bnbbsc', 'usdttrc20', 'usdterc20',
    'usdc', 'usdtbsc', 'pyusd', 'usdcbsc'
  )
);

CREATE OR REPLACE FUNCTION public.handle_crypto_payment_success()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entry_id UUID;
  v_entry public.payment_balance_entries%ROWTYPE;
BEGIN
  IF LOWER(COALESCE(NEW.provider, '')) <> 'crypto' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(OLD.status, '') NOT IN ('succeeded', 'completed')
     AND NEW.status IN ('succeeded', 'completed') THEN
    IF COALESCE(NEW.net_amount_usd, 0) <= 0 THEN
      RAISE EXCEPTION 'crypto_net_amount_usd_required';
    END IF;

    INSERT INTO public.payment_balance_entries (
      payment_id, merchant_id, environment, currency, amount, withdrawable_at
    ) VALUES (
      NEW.id,
      NEW.merchant_id,
      CASE WHEN NEW.environment = 'test' THEN 'test' ELSE 'live' END,
      'USD',
      NEW.net_amount_usd,
      NOW()
    )
    ON CONFLICT (payment_id) DO NOTHING
    RETURNING id INTO v_entry_id;

    IF v_entry_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.environment = 'test' THEN
      UPDATE public.merchants
      SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) + NEW.net_amount_usd,
          updated_at = NOW()
      WHERE id = NEW.merchant_id;
    ELSE
      UPDATE public.merchants
      SET available_balance_usd = COALESCE(available_balance_usd, 0) + NEW.net_amount_usd,
          has_usd_account = true,
          updated_at = NOW()
      WHERE id = NEW.merchant_id;
    END IF;

  ELSIF OLD.status IN ('succeeded', 'completed') AND NEW.status = 'refunded' THEN
    SELECT * INTO v_entry
    FROM public.payment_balance_entries
    WHERE payment_id = NEW.id
    FOR UPDATE;

    IF NOT FOUND OR v_entry.reversed_at IS NOT NULL THEN
      RETURN NEW;
    END IF;

    IF v_entry.environment = 'test' THEN
      UPDATE public.merchants
      SET available_balance_usd_test = COALESCE(available_balance_usd_test, 0) - v_entry.amount,
          updated_at = NOW()
      WHERE id = v_entry.merchant_id;
    ELSE
      UPDATE public.merchants
      SET available_balance_usd = COALESCE(available_balance_usd, 0) - v_entry.amount,
          updated_at = NOW()
      WHERE id = v_entry.merchant_id;
    END IF;

    UPDATE public.payment_balance_entries
    SET reversed_at = NOW()
    WHERE id = v_entry.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_crypto_payment_success()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_crypto_payment_success()
  TO service_role;

DROP TRIGGER IF EXISTS handle_crypto_payment_success ON public.payments;
CREATE TRIGGER handle_crypto_payment_success
AFTER UPDATE OF status ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.handle_crypto_payment_success();

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS crypto_currency TEXT,
  ADD COLUMN IF NOT EXISTS crypto_payout_amount NUMERIC(36, 18),
  ADD COLUMN IF NOT EXISTS crypto_network_fee NUMERIC(36, 18),
  ADD COLUMN IF NOT EXISTS nowpayments_payout_id TEXT,
  ADD COLUMN IF NOT EXISTS nowpayments_batch_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_nowpayments_payout_id_unique
  ON public.withdrawals (nowpayments_payout_id)
  WHERE nowpayments_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS withdrawals_nowpayments_batch_id_idx
  ON public.withdrawals (nowpayments_batch_id)
  WHERE nowpayments_batch_id IS NOT NULL;
