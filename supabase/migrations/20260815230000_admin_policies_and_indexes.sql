BEGIN;

-- Merchants can create and read their own support conversations. Updates,
-- assignment and deletion remain server-side administrative operations.
DROP POLICY IF EXISTS tickets_merchant_access ON public.support_tickets;
DROP POLICY IF EXISTS tickets_service_role ON public.support_tickets;
DROP POLICY IF EXISTS tickets_merchant_select ON public.support_tickets;
DROP POLICY IF EXISTS tickets_merchant_insert ON public.support_tickets;
CREATE POLICY tickets_merchant_select
  ON public.support_tickets FOR SELECT TO authenticated
  USING (merchant_id = public.get_current_merchant_id());
CREATE POLICY tickets_merchant_insert
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (merchant_id = public.get_current_merchant_id());

DROP POLICY IF EXISTS messages_merchant_access ON public.ticket_messages;
DROP POLICY IF EXISTS messages_service_role ON public.ticket_messages;
DROP POLICY IF EXISTS messages_merchant_select ON public.ticket_messages;
DROP POLICY IF EXISTS messages_merchant_insert ON public.ticket_messages;
CREATE POLICY messages_merchant_select
  ON public.ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.merchant_id = public.get_current_merchant_id()
  ));
CREATE POLICY messages_merchant_insert
  ON public.ticket_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.merchant_id = public.get_current_merchant_id()
  ));

-- Cover the foreign keys used by system-core lists, reconciliation and KYC.
CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON public.audit_logs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription_id ON public.invoices (subscription_id);
CREATE INDEX IF NOT EXISTS idx_kyc_events_profile_id ON public.kyc_events (kyc_profile_id);
CREATE INDEX IF NOT EXISTS idx_kyc_events_merchant_id ON public.kyc_events (merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_liveness_merchant_id ON public.kyc_liveness_challenges (merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_profiles_liveness_id ON public.kyc_profiles (liveness_challenge_id);
CREATE INDEX IF NOT EXISTS idx_kyc_profiles_reviewed_by ON public.kyc_profiles (reviewed_by);
CREATE INDEX IF NOT EXISTS idx_payment_links_merchant_id ON public.payment_links (merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments (customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_merchant_id ON public.payments (merchant_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_link_id ON public.payments (payment_link_id);
CREATE INDEX IF NOT EXISTS idx_sms_inbox_payment_id ON public.sms_inbox (payment_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions (plan_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_admin ON public.support_tickets (assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_merchant_id ON public.support_tickets (merchant_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_merchant_id ON public.withdrawals (merchant_id);

COMMIT;
