# Kobara Connect - App Store self-review

Date: 2026-10-21. Read-only application review; no submission or certification.

## Implementation follow-up

The findings and counts below describe the original audit snapshot, before corrections.
Local corrections now add Shopify-origin signed OAuth before account linking, remove manual shop
entry from the merchant screen, minimize mirrored orders, prevent restoration after redaction,
and add a restricted compliance queue with audited scoped exports and completion tracking.
They require `20261021230910_shopify_installation_privacy_hardening.sql`, not yet applied to production.
The migration also minimizes existing mirrored orders. Financial records and retention decisions
remain subject to compliance review; the new export is not a full-system data inventory.
No platform approval, off-platform billing exemption, certification or production deployment is implied.

## Scope and source

Production checkout: `.codex-kobara-production`. Existing uncommitted changes were preserved.
Canonical requirements fetched during this review using Shopify CLI 4.9.4:

`shopify doc fetch --url https://shopify.dev/docs/apps/launch/app-store-review/app-store-ai-self-review-requirements`

This is a subset of locally checkable requirements, not Shopify's official review.
No deployment, live payment, account mutation, or security certification was performed.
The current app is non-embedded, with read_orders/write_orders and no extension TOML files.

## Summary

- Likely passing: 20 (includes requirements whose prohibited feature is absent).
- Likely failing: 5.
- Needs review: 6.
- Category groups skipped: 10.
- Verification: `node --test tests/shopify-connect.test.js`: 39 passed, 0 failed.

## Likely failing

### 1.1.2 - Use Shopify checkout

`src/lib/server/shopify.ts` creates pay.kobara.app links, emails them after an order,
and calls orderMarkAsPaid following external collection. The canonical requirement
explicitly prohibits bypassing payment processing and recording associated transactions.
Obtain a determination from Shopify and use an authorized architecture before submission.
Calling this a manual payment connector does not itself establish an exemption.

### 1.1.7 - Authorized payment gateway architecture

The connector routes buyers to Kobara payment processing, but no Payments Apps extension
or payment-session integration is present. The owner confirmed no written approval.
Shopify must determine the appropriate payment-provider authorization path. Do not merely
add payment scopes to the current Admin API connector; that requires a distinct architecture.

### 1.2.1 - Shopify billing

The owner confirmed transaction fees of 3.9% and withdrawal fees of 5%, charged externally,
while the connector's public plan is free with additional charges. There is no verified
external-billing approval. Shopify must confirm the fee treatment/exemption or app charges
must use an approved billing mechanism. A free connector label alone is not sufficient.

### 2.3.1 - Installation on a Shopify-owned surface

`src/app/dashboard/integrations/shopify/page.tsx` asks merchants to enter their shop domain.
The canonical requirement explicitly disallows manual shop-domain entry in installation
or configuration. Use the authenticated Shopify installation context instead.

### 2.3.2 - Authenticate immediately after install

The configured application URL points to `/integrations/shopify`.
`src/app/integrations/shopify/page.tsx` forwards only connected/disconnected/error query
parameters, discarding Shopify shop/host/HMAC installation context. OAuth starts through
a separate manual connection form and requires an existing approved Kobara account.
Implement a verified Shopify entry flow before the account-linking UI; do not trust raw query
parameters or skip HMAC/state checks to solve this.

## Needs review

- 1.1.4 Factual information: demo payments are explicitly labelled Test and isolated, but
  generated listing graphics contain distorted transaction text and amounts. Reconcile
  those graphics with original screenshots. Public privacy claims about independent
  penetration testing, Argon2id, and blanket encryption require separate evidence.
- 1.1.15 Refunds: this connector has no verified Shopify refund workflow. Verify that any
  refund offered through the wider Kobara product returns through the original processor;
  do not substitute an unrelated wallet or gift card.
- 1.2.2 Billing lifecycle: no Shopify charge approval/decline/reinstall lifecycle is present.
  Applicability depends on Shopify's classification of the externally charged fees.
- 2.2.3 App Bridge: no App Bridge integration was found. The app is explicitly non-embedded;
  confirm the applicable requirement with Shopify rather than incorrectly embedding it
  or assuming the embedded-app rule automatically applies unchanged.
- 2.3.4 Reinstall: token upsert and uninstall cleanup exist and are tested, but the direct
  Shopify reinstall entry has the same installation-context problem as 2.3.2. Test the full
  uninstall/reinstall flow from Shopify, not only the manual domain-entry workflow.
- 3.1.1 TLS: configured URLs use HTTPS; certificate validity, minimum TLS version, and
  rejection of HTTP must be verified against deployed Cloudflare configuration.

## Additional data-protection findings

1. Data minimization: `upsertShopifyOrder` stores the entire payload as raw_order and copies
   phone/first_name/last_name into customer. Requested protected fields currently include
   email only. Minimize the stored webhook payload and remove unnecessary copied fields;
   do not attest strict minimization until the implementation matches the request.
2. Customer erasure after uninstall: the webhook route loads only active installations
   except for app/uninstalled. customers/redact is gated on that active installation, so
   requests after uninstall/disconnect can be acknowledged without erasure. Lookup the
   installation for privacy operations independently of collection permission.
3. Data access requests: customers/data_request only inserts a merchant notification.
   No export or complete operational request record is created in that handler. Verify a
   durable support workflow that retains the necessary request details and meets deadlines.
4. shop/redact deletes the installation and cascades Shopify orders, but payment links,
   payments, webhook receipts, audit records and any retained personal data need a complete
   retention/erasure inventory. A route's 200 response is not proof of complete erasure.
5. The protected-data questionnaire is still a draft (10/16 answered). Backups, DLP,
   incident-response procedures and test/production separation need operational verification.
   No independent certification type or date was supplied; do not fabricate one.

## Requirement ledger

P = likely passing, F = likely failing, R = needs review.

| Requirement | Status | Local evidence / applicability |
| --- | --- | --- |
| 1.1.1 | P | Non-embedded app; no third-party iframe authentication dependency required. |
| 1.1.2 | F | External collection plus orderMarkAsPaid. |
| 1.1.3 | P | No theme installation feature in connector. |
| 1.1.4 | R | Review labelling exists; marketing/security assertions need verification. |
| 1.1.6 | P | Each Shopify installation belongs to one merchant; no multi-seller storefront. |
| 1.1.7 | F | Payment collection without verified authorized Payments Apps path. |
| 1.1.8 | P | No third-party POS synchronization in connector. |
| 1.1.9 | P | Shopify links explicitly set pass_fees_to_customer to false. |
| 1.1.10 | P | No shipping option manipulation. |
| 1.1.13 | P | Product labels come from authenticated shop order payloads, not scraping. |
| 1.1.14 | P | No external agency marketplace in connector. |
| 1.1.15 | R | Wider payment refund handling not certified by this connector review. |
| 1.1.16 | P | No capital lending functionality in connector. |
| 1.2.1 | F | External fees; approval not obtained. |
| 1.2.2 | R | Billing lifecycle depends on external fee classification. |
| 1.2.3 | P | Connector has no multiple paid plans to switch. |
| 2.2.1 | P | OAuth and authenticated Shopify Admin API calls present. |
| 2.2.3 | R | Non-embedded architecture; confirm App Bridge applicability. |
| 2.2.4 | P | Admin operations use GraphQL; OAuth token endpoint is not REST Admin usage. |
| 2.2.6 | P | No admin UI extensions with advertising. |
| 2.2.7 | P | No Max modal use. |
| 2.3.1 | F | Manual myshopify.com form. |
| 2.3.2 | F | App entry drops install context and does not initiate OAuth. |
| 2.3.3 | P | Successful callback redirects to connector UI. |
| 2.3.4 | R | Upsert/uninstall implemented; Shopify-origin reinstall unverified. |
| 3.1.1 | R | HTTPS configured; deployed TLS settings require verification. |
| 3.2.1 | P | No read_all_orders scope. |
| 3.2.2 | P | No write_payment_mandate scope. |
| 3.2.3 | P | No write_checkout_extensions_apis scope. |
| 3.2.4 | P | No read_advanced_dom_pixel_events scope. |
| 3.2.5 | P | No read_checkout_extensions_chat scope. |

## Skipped groups

- 5.1 Online store: no theme extension detected.
- 5.2 Payment: no payment extension or write_payment_gateway scope; this does NOT exempt
  the app from the payment-policy failures in section 1.
- 5.3 Payment facilitator: opt-in group, not expressly requested for evaluation.
- 5.4 Purchase option: no subscription/payment-mandate scopes.
- 5.5 Product sourcing: opt-in group, not requested.
- 5.6 Checkout customization: no checkout UI extension.
- 5.7 Sales channel: no channel_config extension.
- 5.8 Post purchase: no checkout_post_purchase extension. An email after an order is not
  this Shopify extension type.
- 5.9 Mobile app builders: opt-in group, not requested.
- 5.10 Donation: opt-in group, not requested.

## Resources

- https://shopify.dev/docs/apps/launch/shopify-app-store/app-store-requirements
- https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices
- https://shopify.dev/docs/apps/launch/billing
- https://shopify.dev/docs/apps/launch/app-store-review/submit-app-for-review
