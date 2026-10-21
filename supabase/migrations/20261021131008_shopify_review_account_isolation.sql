BEGIN;
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS shopify_review_mode BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.merchants.shopify_review_mode IS 'Isolated Shopify demonstration. Operational KYC approval is simulated, not identity verification.';

CREATE OR REPLACE FUNCTION public.guard_shopify_review_merchant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.shopify_review_mode AND NOT NEW.shopify_review_mode THEN
    RAISE EXCEPTION 'review_account_cannot_become_live';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.shopify_review_mode AND (NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.email IS DISTINCT FROM OLD.email) THEN
    RAISE EXCEPTION 'review_account_identity_immutable';
  END IF;
  IF NEW.shopify_review_mode THEN
    IF TG_OP = 'INSERT' OR NOT OLD.shopify_review_mode THEN
      IF current_user NOT IN ('postgres', 'service_role', 'supabase_admin') THEN
        RAISE EXCEPTION 'review_account_admin_only';
      END IF;
    END IF;
    IF COALESCE(NEW.available_balance, 0) <> 0 OR COALESCE(NEW.available_balance_usd, 0) <> 0
      OR COALESCE(NEW.pending_balance, 0) <> 0 OR COALESCE(NEW.pending_balance_usd, 0) <> 0
      OR COALESCE(NEW.reserved_balance, 0) <> 0 THEN
      RAISE EXCEPTION 'review_account_real_funds_forbidden';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_shopify_review_merchant ON public.merchants;
CREATE TRIGGER guard_shopify_review_merchant BEFORE INSERT OR UPDATE ON public.merchants
FOR EACH ROW EXECUTE FUNCTION public.guard_shopify_review_merchant();

CREATE OR REPLACE FUNCTION public.guard_shopify_review_money()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.merchants WHERE id = OLD.merchant_id AND shopify_review_mode)
    AND (NEW.merchant_id IS DISTINCT FROM OLD.merchant_id OR NEW.environment IS DISTINCT FROM OLD.environment) THEN
    RAISE EXCEPTION 'review_account_reassignment_forbidden';
  END IF;
  IF EXISTS (SELECT 1 FROM public.merchants WHERE id = NEW.merchant_id AND shopify_review_mode) THEN
    IF TG_TABLE_NAME = 'withdrawals' THEN
      RAISE EXCEPTION 'review_account_withdrawals_forbidden';
    END IF;
    IF NEW.environment IS DISTINCT FROM 'test' THEN
      RAISE EXCEPTION 'review_account_test_environment_required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_shopify_review_money() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_shopify_review_money ON public.payments;
CREATE TRIGGER guard_shopify_review_money BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.guard_shopify_review_money();
DROP TRIGGER IF EXISTS guard_shopify_review_money ON public.withdrawals;
CREATE TRIGGER guard_shopify_review_money BEFORE INSERT OR UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.guard_shopify_review_money();
DROP TRIGGER IF EXISTS guard_shopify_review_money ON public.payment_balance_entries;
CREATE TRIGGER guard_shopify_review_money BEFORE INSERT OR UPDATE ON public.payment_balance_entries
FOR EACH ROW EXECUTE FUNCTION public.guard_shopify_review_money();
COMMIT;
