-- Cover partner-program foreign keys used by authorization, cleanup and reports.

CREATE INDEX IF NOT EXISTS developer_accounts_activated_by_idx
  ON public.developer_accounts (activated_by) WHERE activated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS developer_invitations_developer_idx
  ON public.developer_invitations (developer_id);
CREATE INDEX IF NOT EXISTS developer_invitations_merchant_idx
  ON public.developer_invitations (merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS developer_connections_withdrawal_granted_by_idx
  ON public.developer_merchant_connections (withdrawal_access_granted_by)
  WHERE withdrawal_access_granted_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS developer_connections_first_payment_idx
  ON public.developer_merchant_connections (first_merchant_api_payment_id)
  WHERE first_merchant_api_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ambassador_accounts_activated_by_idx
  ON public.ambassador_accounts (activated_by) WHERE activated_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_applications_reviewed_by_idx
  ON public.partner_applications (reviewed_by) WHERE reviewed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS referral_attributions_ambassador_idx
  ON public.referral_attributions (ambassador_id) WHERE ambassador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_commission_source_merchant_idx
  ON public.partner_commission_ledger (source_merchant_id) WHERE source_merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_commission_source_subscription_idx
  ON public.partner_commission_ledger (source_subscription_id) WHERE source_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_withdrawals_developer_idx
  ON public.partner_withdrawals (developer_id, requested_at DESC) WHERE developer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_withdrawals_ambassador_idx
  ON public.partner_withdrawals (ambassador_id, requested_at DESC) WHERE ambassador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS partner_withdrawals_merchant_idx
  ON public.partner_withdrawals (merchant_id, requested_at DESC) WHERE merchant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS api_keys_created_by_user_idx
  ON public.api_keys (created_by_user_id) WHERE created_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS api_keys_developer_idx
  ON public.api_keys (developer_id) WHERE developer_id IS NOT NULL;
