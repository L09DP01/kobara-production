BEGIN;

-- Keep historical invoices and payments; retire only recurring commercial access.
UPDATE public.subscriptions SET auto_renew = false, cancel_at_period_end = true;
UPDATE public.plans SET monthly_payment_limit = NULL, api_keys_limit = NULL,
  daily_withdrawal_limit = 50000, transaction_fee_percent = 3.9;
UPDATE public.plans SET price_htg = 0, status = 'active' WHERE slug = 'free';
UPDATE public.plans SET status = 'inactive' WHERE slug <> 'free';
UPDATE public.settings SET transaction_fee_percent = 3.9;

CREATE OR REPLACE FUNCTION public.get_effective_plan_limits(p_merchant_id UUID)
RETURNS TABLE(plan_slug TEXT, monthly_payment_limit INTEGER, api_keys_limit INTEGER, daily_withdrawal_limit NUMERIC)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT 'free'::TEXT, NULL::INTEGER, NULL::INTEGER, 50000::NUMERIC;
$$;
REVOKE ALL ON FUNCTION public.get_effective_plan_limits(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_plan_limits(UUID) TO service_role;

DROP TRIGGER IF EXISTS enforce_withdrawal_plan_limit_on_insert ON public.withdrawals;

CREATE OR REPLACE FUNCTION public.enforce_withdrawal_transaction_amount()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_amount NUMERIC;
BEGIN
  IF COALESCE(NEW.environment, 'live') <> 'live' OR LOWER(COALESCE(NEW.provider, '')) = 'system_subscription' THEN RETURN NEW; END IF;
  IF UPPER(COALESCE(NEW.currency, 'HTG')) = 'USD' AND (NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0) THEN
    RAISE EXCEPTION 'withdrawal_exchange_rate_required';
  END IF;
  v_amount := COALESCE(NEW.total, NEW.amount) * CASE WHEN UPPER(COALESCE(NEW.currency, 'HTG')) = 'USD' THEN NEW.exchange_rate ELSE 1 END;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 75000 OR v_amount::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'withdrawal_transaction_limit:75000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_withdrawal_transaction_amount ON public.withdrawals;
CREATE TRIGGER enforce_withdrawal_transaction_amount BEFORE INSERT ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.enforce_withdrawal_transaction_amount();
REVOKE ALL ON FUNCTION public.enforce_withdrawal_transaction_amount() FROM PUBLIC, anon, authenticated;

-- No new balance-funded subscriptions, even from an obsolete client.
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('purchase_subscription_from_balance', 'purchase_subscription_from_balance_with_promo')
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role', f.signature); END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
