# Usage-based pricing rollout

## Commercial rules

- No subscription required for merchant features. KYC, roles, available funds, OTP, provider availability and anti-abuse protections remain enforced.
- Successful MonCash/NatCash payments: 3.9%. Local wallet withdrawals: 5%, deducted from the requested amount.
- Card/PayPal pricing continues to use the USD account provider configuration. Existing USD and crypto-specific fees are not replaced with local wallet fees.
- No monthly payment quota or API-key count quota.
- Dashboard withdrawal quota: 50,000 HTG per Haitian calendar day. Public API withdrawals do not consume this daily quota.
- Every withdrawal: maximum 75,000 HTG, including USD converted using its recorded administrative rate.
- Failed/rejected/cancelled dashboard withdrawals do not consume the daily quota.

## Database migration required before deploying this release

Apply `20261015143800_usage_based_merchant_pricing.sql` after the previous `20261013223802_haitian_daily_withdrawal_limits.sql` migration. Do not change the historical migration to rerun it after this new one: it would restore obsolete limits.

The new migration preserves financial records, disables renewal, retires paid plans, removes commercial payment/key quotas and installs the per-withdrawal database guard. Existing payment amounts and recorded fees are not rewritten.

An already-paid historical subscription callback can still be reconciled. New subscription creation and mobile renewal routes return HTTP 410. The former billing page redirects to the dashboard. Subscription expiration processing is disabled.

The SQL was verified inside a rolled-back transaction, including 75k HTG/USD boundaries and the 50k dashboard limit. This verification does not apply the migration in production. User requested manual migration execution.

Before deploying, confirm the production database and apply the migration there. Review treatment of prepaid subscription periods separately; no automatic refund or balance adjustment is performed by this release.
