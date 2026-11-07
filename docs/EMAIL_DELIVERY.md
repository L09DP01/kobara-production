# Email delivery

Transactional emails use the Workers `EMAIL` binding configured in
`wrangler.jsonc`. Deploy the Worker configuration together with the code.
The sender domain must be enabled in Cloudflare Email Sending. No additional
API token is needed for this binding. Keep the Resend credentials configured.

`CLOUDFLARE_FROM_EMAIL` optionally overrides the configured sender address.
Shopify payment emails preserve the merchant display name and reply-to address.
There is no primary-provider override to Resend; it is called only by fallback.

Resend is used when the binding is unavailable, or Cloudflare explicitly reports
a sender configuration error, quota/rate limit, or delivery rejection.
Suppression, account suspension and recipient restrictions are not bypassed.
An uncertain result (including an unclassified network failure) is returned as
an error instead of immediately sending a second copy through Resend. Inspect
Cloudflare delivery logs before manually retrying these messages.

A message ID means accepted, not delivered to the inbox. Asynchronous bounces
do not currently trigger fallback. There is no cross-provider exactly-once
guarantee. Resend retries reuse the same idempotency key within each send.

Marketing campaigns and smart promotions use Amazon SES SMTP as primary.
Resend is only the backup for either primary transport. Cloudflare Email
Sending is used only for transactional messages. Shopify review-account email
suppression remains active before either transport is invoked.

## Amazon SES SMTP

Configure these server-only Worker secrets (never NEXT_PUBLIC variables):

```
SES_SMTP_HOST=email-smtp.us-east-2.amazonaws.com
SES_SMTP_PORT=465
SES_SMTP_USER=<regional SES SMTP username>
SES_SMTP_PASSWORD=<regional SES SMTP password>
SES_SMTP_FROM=Kobara <noreply@kobara.app>
```

Use SMTP credentials, not an AWS console password or an AWS API access key.
The sending identity and SMTP credentials must belong to the selected SES region.
The non-secret host, port and sender are configured in Wrangler. Store only the
username and password in the Worker secrets `SES_SMTP_USER` and
`SES_SMTP_PASSWORD`. Without complete SES configuration, marketing is stopped
before claiming queued recipients; Resend does not become its default provider.
Port 465/2465 uses implicit TLS; 587/2587 requires STARTTLS. Certificate validation
is mandatory; port 25 and arbitrary non-SES hosts are rejected. No SMTP connection
is opened at module import, and no sockets are pooled across Worker requests.

SES Mail Manager authenticated ingress endpoints are also supported. For these,
use the exact `*.mail-manager-smtp.amazonaws.com` hostname shown in the console,
port `587` (mandatory STARTTLS), and the username/password from its downloaded
CSV. Do not combine Mail Manager credentials with the classic regional endpoint.
The configured Mail Manager rule set must send messages to the Internet through
SES; an active ingress endpoint alone does not confirm final delivery or SES
production approval. The host/port in Wrangler must be updated when switching.

Before marketing sends, verify the domain/DKIM identity, obtain SES production
access if the account is still sandboxed, and configure bounce/complaint and
suppression handling in SES. Keep existing campaign consent and unsubscribe
checks active. Local tests mock SMTP and do not prove remote SES delivery.

Only confirmed pre-submission failures and explicit temporary SMTP rejections
fall back automatically. Permanent recipient/policy rejection and an uncertain
disconnect during DATA are returned as errors, without bypassing them via Resend.
SMTP has no cross-provider idempotency guarantee; a message accepted by SES must
not be resent merely because a later delivery notification is delayed.

Bulk delivery uses one recipient per message through the same provider selector;
maintenance notifications are transactional. The existing Resend receiving API
and inbound-support webhook are independent and remain unchanged.

Reference: https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
