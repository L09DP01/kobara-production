-- Drop existing vulnerable UPDATE policies
DROP POLICY IF EXISTS "Merchant users can update their own merchant" ON public.merchants;
DROP POLICY IF EXISTS "Merchant users can update their customers" ON public.customers;
DROP POLICY IF EXISTS "Merchant users can update their payment links" ON public.payment_links;
DROP POLICY IF EXISTS "Merchant users can update their payments" ON public.payments;
DROP POLICY IF EXISTS "Merchant users can update their api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Merchant users can update their webhook endpoints" ON public.webhook_endpoints;
DROP POLICY IF EXISTS "Merchant users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Merchant users can update their settings" ON public.settings;

-- Create secure UPDATE policies with WITH CHECK

-- Merchants
CREATE POLICY "Merchant users can update their own merchant" ON public.merchants 
FOR UPDATE USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Customers
CREATE POLICY "Merchant users can update their customers" ON public.customers 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- Payment Links
CREATE POLICY "Merchant users can update their payment links" ON public.payment_links 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- Payments
CREATE POLICY "Merchant users can update their payments" ON public.payments 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- API Keys
CREATE POLICY "Merchant users can update their api keys" ON public.api_keys 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- Webhooks
CREATE POLICY "Merchant users can update their webhook endpoints" ON public.webhook_endpoints 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- Notifications
CREATE POLICY "Merchant users can update their notifications" ON public.notifications 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());

-- Settings
CREATE POLICY "Merchant users can update their settings" ON public.settings 
FOR UPDATE USING (merchant_id = get_current_merchant_id()) 
WITH CHECK (merchant_id = get_current_merchant_id());
