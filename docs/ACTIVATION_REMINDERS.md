# Merchant activation reminders

## Cycle

- KYC not approved: reminder to finish verification, with a status-check note for already-submitted documents.
- KYC approved, no successful real customer payment: reminder to create the first payment link.
- First successful live customer payment: stop both cycles. Test payments, B2B ledger entries and historical subscription purchases do not qualify.
- At least 72 hours between successful reminder deliveries. Switching from KYC to first-payment guidance starts a new 72-hour delay.
- Existing accounts receive a 3-day grace period after the scheduler first enrolls them.
- Suspended/closed accounts, unverified owner email addresses and opted-out accounts are excluded. Owner email must match the merchant contact email.

## Delivery and security

The SQL queue uses leases, SKIP LOCKED and stable Resend idempotency keys. Current eligibility is rechecked immediately before sending. A payment confirmed after a message is already handed to the email provider cannot recall that message; subsequent attempts stop.

Ten due messages are processed per request; up to 500 accounts are enrolled per request. Only successful deliveries advance the 3-day cadence. Failed attempts retry later with the same delivery ID. Uncertain attempts older than 23 hours are withheld for manual review rather than risk duplicate sends outside Resend's 24-hour deduplication window.

Users can disable reminders in Settings > Notifications, including before KYC approval. Transactional payment receipts are unaffected.

## Activation

1. Apply `supabase/migrations/20261015150245_merchant_activation_email_cycle.sql` to the confirmed production database.
2. Deploy the code with the existing Resend configuration and a nonempty `CRON_SECRET`.
3. Set the GitHub repository secret `KOBARA_CRON_SECRET` to the exact same production `CRON_SECRET`, using the secret UI or secure stdin, never committed code.
4. Push the workflow to the default branch. It calls the protected endpoint hourly; database timestamps determine each merchant's three-day interval. GitHub scheduled runs can be delayed.
5. Inspect workflow results and queued state. `ACTIVATION_REMINDERS_ENABLED=false` pauses delivery. The former `/api/cron/kyc-reminders` route uses this same queue, so overlapping scheduler calls do not create an independent daily campaign.

The endpoint rejects missing credentials and fails closed if the migration is unavailable. Do not trigger a live test against real customers without checking recipients. No production migration or customer email was sent during implementation.

Review uncertain deliveries:

```sql
SELECT merchant_id, kind, delivery_id, delivery_started_at
FROM public.merchant_activation_reminders
WHERE completed_at IS NULL AND delivery_started_at < NOW() - INTERVAL '23 hours';
```

References: https://resend.com/docs/dashboard/emails/idempotency-keys
