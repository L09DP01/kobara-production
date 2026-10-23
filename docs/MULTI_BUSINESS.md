# Multi-business accounts

## Activation

Apply `supabase/migrations/20261023204248_multi_business_accounts.sql` to the
confirmed deployment database before enabling creation in production. The file
has been executed only against isolated local PostgreSQL fixtures, not live data.
The creation action returns an unavailable message if the RPC is not installed.

The Supabase project configured locally must not be assumed to be production.
Do not run `db push` against an unconfirmed project.

## Merchant Workflow

The existing business/avatar button opens the business selector on desktop and
mobile web. Selection is validated on the server against ownership or active team
membership. Each business keeps its own merchant ID and existing merchant-scoped
payments, balances, keys, webhooks, customers, withdrawals and Shopify connection.
No keys, balances, integrations or identity documents are copied to a new business.

Adding a business requires an authenticated, non-revoked owner session and a
verified, unrestricted primary identity. A new business references that identity
using `identity_owner_merchant_id`; it does not start another Didit session.
The new activity is initially in review, with no live collection access. Test is
an environment label, not an exemption from business verification or an automatic
grant of simulation privileges.

System Core > KYC shows the activity description, address and declared website,
plus the primary identity reference. Compliance can approve/reject it separately.
Approval is atomic and requires the primary owner to remain verified. Rejection
and owner reverification keep live access disabled. The support link handles any
request for additional evidence; documents are not duplicated automatically.

If the primary identity is restricted/reverification is required, approved linked
businesses lose live KYC access without changing balances. Restoring the primary
identity alone does not automatically approve those business reviews again.

## Isolation And Compatibility

Server-rendered and browser Supabase clients pass `x-kobara-merchant-id`. RLS
validates that identifier against the signed-in user's ownership or membership;
an unauthorized/invalid header returns no business, never another user's data.
Without a selection, the oldest owned business is the stable default. API-key
authentication remains bound to the key's own merchant, independently of cookies.

The selection cookie is an identifier, not an authorization token. Switching uses
a server action and a full navigation; other open web tabs refresh their context
using a storage event. Invalid/deleted selections go to `/businesses` for recovery.
No extra business may be used to revive a revoked account session.

Existing native-mobile endpoints retain the primary business as their default.
This change adds a selector to the responsive web dashboard, not to the native
mobile application.

## Tests

`node --test tests/multi-business-context.test.js tests/multi-business-schema.test.js tests/kyc-page.test.js`

The schema suite runs the actual migration and RPCs in an ephemeral PGlite
PostgreSQL instance, including RLS, role grants, forged contexts, idempotency,
approval, parent restriction propagation and fund preservation.

`tests/ui/business-switcher-fixture.mjs` renders the actual header and creation
dialog with test-only framework/action mocks and fictitious data. The Playwright
script exercises desktop and mobile viewports. It makes no real authentication,
business-creation, email or provider requests.
