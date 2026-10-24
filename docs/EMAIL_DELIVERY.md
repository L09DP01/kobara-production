# Email delivery

Transactional emails use the Workers `EMAIL` binding configured in
`wrangler.jsonc`. Deploy the Worker configuration together with the code.
The sender domain must be enabled in Cloudflare Email Sending. No additional
API token is needed for this binding. Keep the Resend credentials configured.

`CLOUDFLARE_FROM_EMAIL` optionally overrides the configured sender address.
Shopify payment emails preserve the merchant display name and reply-to address.
Set `EMAIL_PRIMARY_PROVIDER=resend` to temporarily use Resend directly.

Resend is used when the binding is unavailable, or Cloudflare explicitly reports
a sender configuration error, quota/rate limit, or delivery rejection.
Suppression, account suspension and recipient restrictions are not bypassed.
An uncertain result (including an unclassified network failure) is returned as
an error instead of immediately sending a second copy through Resend. Inspect
Cloudflare delivery logs before manually retrying these messages.

A message ID means accepted, not delivered to the inbox. Asynchronous bounces
do not currently trigger fallback. There is no cross-provider exactly-once
guarantee. Resend retries reuse the same idempotency key within each send.

Marketing campaigns and smart promotions remain on Resend: Cloudflare Email
Sending is used only for transactional messages. Shopify review-account email
suppression remains active before either transport is invoked.

Reference: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
