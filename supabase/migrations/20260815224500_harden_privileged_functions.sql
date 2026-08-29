BEGIN;

-- Trigger functions are invoked by PostgreSQL and must never be public RPCs.
REVOKE ALL ON FUNCTION public.handle_payment_success() FROM PUBLIC, anon, authenticated;

-- These financial functions are only called through authenticated server
-- routes using the service role. In particular, callers must not choose an
-- arbitrary sender_id for a privileged B2B transfer.
REVOKE ALL ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR)
  TO service_role;

REVOKE ALL ON FUNCTION public.sync_all_merchant_balances()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_all_merchant_balances()
  TO service_role;

-- This helper is intentionally available to authenticated users because RLS
-- policies call it. Anonymous requests have no legitimate use for it.
REVOKE ALL ON FUNCTION public.get_current_merchant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_merchant_id() TO authenticated, service_role;

ALTER FUNCTION public.handle_payment_success() SET search_path = public, pg_temp;
ALTER FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR) SET search_path = public, pg_temp;
ALTER FUNCTION public.sync_all_merchant_balances() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_current_merchant_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_single_active_document() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_ai_derived_rules_updated_at() SET search_path = public, pg_temp;

COMMIT;
