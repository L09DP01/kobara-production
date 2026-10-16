# Smart promotions

## Core workflow

`/system-core/smart-promotions` is restricted to super-admin and operations roles. It shows matching/eligible counts for active payment links with no successful customer payment, unused Live API integrations, and merchants inactive for thirty days.

An administrator chooses a segment and a random sample of up to fifty distinct email addresses. The AI reads verified public Kobara sources but receives no customer names, email addresses, balances, private conversations or KYC documents. Generated subject/body must pass a restrictive plain-text validator: no prices, discounts, unverified free offers, instant-settlement promises, HTML or model-chosen links.

The draft does not send automatically. An administrator reviews its body and recipient list and explicitly approves it. Approved campaigns can be paused, processed manually in batches of ten, or processed by the hourly protected cron. The scheduler never creates or approves a campaign.

## Eligibility and consent

Promotion consent is OFF by default. Owners can enable it under Settings > Notifications. No opt-in is inferred from KYC, signup or successful payments. Zero eligible recipients is therefore a valid initial state.

Candidates require approved KYC, active accounts and verified matching owner/contact email addresses. Open support tickets, closed/suspended accounts, opt-outs, recent activation reminders and emails sent within fourteen days through either this new circuit or the existing manual campaign ledger exclude candidates. These exclusions are checked again before sending. Legacy manual campaign behavior is otherwise unchanged.

Reservation locks prevent two smart campaigns from sending concurrently to the same email. Sending leases use stable per-recipient Resend idempotency keys. Failed attempts also impose a fourteen-day exclusion to avoid another campaign retrying a potentially accepted but unacknowledged email. Uncertain deliveries older than twenty-three hours remain in review rather than automatically retry beyond provider deduplication guarantees. A pause or payment that occurs after an email is already handed to Resend cannot recall that message.

Every email has a signed unsubscribe link. Opening the link only shows confirmation; the form POST writes suppression. Link scanners cannot unsubscribe via GET. Tokens contain no email address. Opt-out applies to the address across this smart-promotion circuit. Owners may explicitly opt back in through authenticated settings. Security messages and payment receipts are unaffected.

## Rollout

Apply `20261015152938_smart_promotions.sql` after `20261015150245_merchant_activation_email_cycle.sql`. Deploy code with the existing Gemini and Resend credentials. Configure a stable server-only `PROMOTION_UNSUBSCRIBE_SECRET` of at least thirty-two characters, or an existing stable AUTH_SECRET/NEXTAUTH_SECRET. Changing it invalidates existing unsubscribe links; prefer a dedicated stable secret.

The Cloudflare Worker scheduler also dispatches `/api/cron/smart-promotions` hourly, using the existing production `CRON_SECRET`. It only processes approved campaigns and never generates or approves one. GitHub automatic scheduling is disabled. `SMART_PROMOTIONS_ENABLED=false` pauses sending. Migration and deployment are separate from local implementation.

No real promotional email was sent during development. SQL tests used rollback-only synthetic accounts with example.invalid addresses. Review deferred sending rows before manually retrying after an uncertain provider response.
