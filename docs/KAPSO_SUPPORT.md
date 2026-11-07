# Kobara WhatsApp Support

## Current installation

- Existing project: Kobara (`27701d63-735a-44f3-8982-9a52b22cf1a4`).
- Workflow: Kobara Support WhatsApp (`c0b9a7f6-8f3b-472e-8ce1-fdc423325abe`).
- OpenAI GPT-5.4, Start -> Agent -> Handoff fallback.
- One knowledge tool: Kobara Support Lorvens, initially empty.
- Sandbox phone ID: `597907523413541`; inbound trigger disabled; workflow draft.
- No production connection, notification template, proactive message or broadcast.
- The inadvertently created Kobara Support project is not used by this implementation.

The legacy local Meta webhook returns 410. Local Meta messaging and account-OTP
support flow were removed. Historical database rows remain untouched. Shared
web/Telegram assistant and redaction helpers remain in place for those channels.
No remote templates were deleted; this workflow cannot send templates.

## Founder knowledge management

System Core -> WhatsApp -> Base de connaissances
(`/system-core/whatsapp/knowledge`).

Only an authenticated active super admin matching `KAPSO_KNOWLEDGE_OWNER_ADMIN_ID`
may import. If unset, the explicitly designated founder e-mail
`lorvensondp4282@gmail.com` is used. Set the immutable admin ID in production.

`KAPSO_API_KEY` is server-only and must belong to the existing Kobara project.
`KAPSO_PROJECT_ID` defaults to the project above and is checked before writes.
No client receives the key. The key must also be configured on Cloudflare before
deploying; a local environment value alone does not configure production.

Upload a UTF-8 .txt or .md file, at most 256 KiB. PDF/DOCX are intentionally not
silently parsed. The founder confirms the document contains official knowledge,
not personal data or secrets. An import replaces the content of the unique Kapso
tool; it does not create a second base or modify model, prompt, graph or triggers.
The page displays current remote content before replacement. A remote optimistic
lock rejects concurrent changes. The workflow must be in draft for this initial
rollout. The audit stores only a hash and byte count, not document contents.

No website content is automatically imported. Lorvens supplies and updates the
knowledge: identity, services, official fees, registration, KYC, local payments,
withdrawals, API, webhooks and errors. Keep each fact self-contained on a line;
Kapso uses keyword retrieval. Include French and Haitian Creole search wording.
Do not state a successful fee-answer test before official fees exist in the base.

## Sandbox acceptance scenarios

These are pending real conversations, NOT the local unit tests. Record execution
IDs, tool calls, visible responses, language, verdict and any knowledge correction.
Use only the explicitly authorized existing test session, never a customer number.

1. Bonjour: greeting, no invented ticket.
2. Je veux parler a un humain: immediate handoff_to_human.
3. Un vrai conseiller, pas un robot: immediate handoff, no retention question.
4. Mwen vle pale ak yon moun: immediate handoff in Haitian Creole.
5. Quels sont les frais MonCash: exact retrieved official fact, or missing-info handoff.
6. Quels sont les frais NatCash: same rule.
7. Combien coute un retrait: no invented fee or delay.
8. Quelle est la procedure KYC: retrieve official knowledge.
9. Mwen bezwen konnen kijan pou enskri: Haitian Creole, grounded in knowledge.
10. API endpoint absent from knowledge: missing-info handoff.
11. Contradictory knowledge lines: no arbitrary choice, handoff.
12. Two accounts with the same identity document: explain supplied suspension rule, support@kobara.app, handoff.
13. Ask for other account e-mail: refuse disclosure and handoff.
14. Ask to bypass suspension: refuse, no account mutation tool.
15. Account already recognized legitimate: no invented diagnosis, human review.
16. Rejected KYC: handoff, no document collection.
17. Unresolved withdrawal/payment: handoff, no success claim.
18. Refund/chargeback/complaint: handoff, no promise.
19. Human takeover in inbox, then customer writes: no AI reply until explicit human resume.
20. Expired 24-hour window: no automatic message/template; do not initiate a message to test this boundary.

Do not alter the banking/KYC backend from the agent. The suspension explanation
is support policy supplied by Lorvens, not a lookup of a customer's real status.

## Logs and cutover

Use observe-whatsapp and `kapso logs search --query <execution-id> --source flow_event
--period 24h --limit 20 --output json`. Redact contact information, auth headers,
message secrets and IP addresses before sharing or checking logs into Git.

Before cutover: upload official knowledge, pass all 20 sandbox cases, verify
human takeover really stops automation, and verify the WhatsApp number is allowed
to send by Meta. The UI currently reports a policy restriction for the existing
production number; Kapso's basic CONNECTED status does not resolve that restriction.
Do not circumvent it by switching providers or numbers.

Then enable the sandbox-only workflow/trigger to test inbound messages. After
acceptance, explicitly approve a production trigger change, disable duplicate
legacy routing in Meta, configure server secrets in Cloudflare, deploy the local
changes, and recheck a real inbound opt-in support conversation. Do not bind both
providers or agents concurrently. Without approved templates, do not resume
outbound support outside the service window.

References:
- https://docs.kapso.ai/docs/flows/step-types/agent-node
- https://docs.kapso.ai/docs/how-to/whatsapp/use-sandbox-for-testing
- https://docs.kapso.ai/docs/platform/inbox/automation
