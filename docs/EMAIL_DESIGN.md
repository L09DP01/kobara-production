# Kobara email design

All outgoing single and batch messages pass through the shared renderer in
`src/lib/server/email/template.ts`. Transport selection, recipients, subject,
plain text, sender name, reply-to, idempotency and review-account suppression
remain unchanged. No new notification triggers are introduced.

The renderer uses a dark branded header, orange accents, a white content area
and an understated footer. Status colors and internal-only banners are visual
classifications, not authorization or delivery decisions.

Existing HTML is parsed with htmlparser2 and rendered with inline email styles.
Fixed-width legacy wrappers, executable markup and unsafe URL schemes are
removed. Supported text, headings, lists, images, details tables and links are
preserved. OTP values remain a single selectable six-digit string. Plain-text
messages receive the same branding without interpreting text as HTML.

Campaign unsubscribe URLs and notification preferences supplied by callers are
preserved. The renderer does not invent unsubscribe tokens, transaction details,
expiry periods, refunds or statuses. Shopify payment emails retain the shop name,
product, order reference and actual payment URL. Transport configuration is managed separately from the design.

Local preview (fictitious content, never sends email):

```
node tests/ui/email-gallery.mjs
```

Open http://127.0.0.1:3041 to browse 57 example scenarios. These are design
fixtures, not reproductions of production customer data. Unit tests cover
escaping, link preservation, status variants, OTP and transport integration.
Browser checks cover widths of 320, 390 and 1440 pixels. This is not a substitute
for delivery testing in Gmail, Apple Mail and Outlook: email clients may ignore
rounded corners or apply their own dark-mode colors. Tables and inline styles
provide the baseline layout without JavaScript, remote fonts or SVG icons.
