# Account and Business Settings

## Shared By The Owner Account

- Login email, personal name and password: `users`.
- Passkeys and two-factor authentication: resolved by the authenticated user,
  never by the active-business cookie. Existing MFA and passkeys are retained.
- Sessions: listing and revocation are scoped to `user_id`, across businesses.
- Telegram: one owner association is visible from every owned business; bot
  operations still use the explicitly selected business. Notification delivery
  resolves the owner from the payment or withdrawal business.
- Personal identity KYC is reused; activity approval remains business-specific.

For compatibility, shared security remains in an owned merchant's existing
`settings.security_json`. A deterministic account resolver reuses existing MFA
and legacy passkeys. The first security write records `account_user_id` so
disabling MFA or deleting a key cannot reactivate stale business settings.
Legacy credential discovery must recheck the authoritative account key list.
No business settings, balances or keys are copied to other businesses.
Only a safe MFA/passkey summary is sent to the settings client.

## Separate For Each Business

- Business name, logo, address, professional phone, category and website.
- Activity approval, restrictions, balances and transaction history.
- API keys, webhooks, Shopify connection and exchange rate.
- Customers, payment links, payment methods and payout destinations.
- Team membership and developer permissions.
- Business payment notification preferences. Marketing suppression remains
  email-based; Telegram notification preference follows the owner association.
- Withdrawal/B2B OTP challenges remain business-scoped even though the
  Authenticator configuration is shared. A code for one business must not
  authorize another business's withdrawal.

The automatic app-installation prompt is no longer mounted on the site.
The email login challenge uses a compact single-column layout, without the
marketing header, illustration or footer.
