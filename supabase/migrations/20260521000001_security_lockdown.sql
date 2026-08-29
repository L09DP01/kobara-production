-- Drop existing vulnerable INSERT policies
DROP POLICY IF EXISTS "Merchant users can insert their own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Merchant users can insert their customers" ON public.customers;
DROP POLICY IF EXISTS "Merchant users can insert their payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Merchant users can insert their payments" ON public.payments;
DROP POLICY IF EXISTS "Merchant users can insert their withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Merchant users can insert their api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Merchant users can insert their webhook endpoints" ON public.webhook_endpoints;

-- Also revoke UPDATE and DELETE on payments, withdrawals, and api_keys as they are managed purely by backend
DROP POLICY IF EXISTS "Merchant users can update their payments" ON public.payments;
DROP POLICY IF EXISTS "Merchant users can update their withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Merchant users can update their api keys" ON public.api_keys;

-- Note: We leave SELECT policies intact so the frontend can still display the data.
-- We also leave INSERT policies for payment_links, customers, and webhook_endpoints if the frontend relies on them,
-- BUT to be fully secure against bypass, we should drop them all and rely on the Server Action with service_role.

-- Let's drop INSERT for all sensitive financial/billing tables:
-- API Keys, Payments, Withdrawals
-- The API or Server Action will use the service_role key to bypass RLS and insert them safely.
