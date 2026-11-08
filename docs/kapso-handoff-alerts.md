# Kapso Human Handoff Email Alerts

The receiver is `POST /api/webhooks/kapso`. It accepts only signed
`workflow.execution.handoff` events for the configured project and workflow.
It sends an internal transactional email, not a WhatsApp template or Kobara ticket.

## Runtime Configuration

- `KAPSO_HANDOFF_WEBHOOK_SECRET`: signing secret of the project webhook.
- `KAPSO_PROJECT_ID`: existing project identifier.
- `KAPSO_SUPPORT_WORKFLOW_ID`: existing support workflow identifier.
- `KAPSO_HANDOFF_ALERT_EMAIL`: authorized team recipient (support mailbox).
- Existing `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are required.
- Existing transactional email configuration is reused.

Configure the project webhook in Kapso for `workflow.execution.handoff` only.
Use the production HTTPS receiver after deploying it; keep the webhook inactive
until the receiver and its secrets are ready. Never commit identifiers or secrets.

## Delivery And Recovery

Redis stores only a signed-event hash and delivery state for 30 days. Events older
than seven days are rejected. Repeated handoffs of the same execution are distinct
when their occurrence timestamps differ. Concurrent deliveries cannot both send.

A `sent` event is acknowledged without another email. An uncertain or failed send
retains `pending` and returns 503 rather than risking duplicate alerts. Monitor
`[Kapso] Handoff email requires delivery verification` (hash only, no customer data).
An operator must check the email provider's delivery log before recovering a pending
event: mark it sent if accepted, or remove its Redis key and redeliver the original
Kapso event only when non-delivery has been confirmed. Redis failure never permits
an untracked send. This intentionally favors duplicate prevention over blind retries.

Automated tests use synthetic events and a fake mailer; no real customer messages
or team emails are sent by the test suite.
