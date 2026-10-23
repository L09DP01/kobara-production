import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import ts from 'typescript';
import * as policy from '../src/lib/kyc-resolution-policy.ts';

const require = createRequire(import.meta.url);
process.env.KYC_IDENTITY_FINGERPRINT_SECRET = 'unit-test-placeholder-only';
process.env.DIDIT_WEBHOOK_SECRET = 'unit-webhook-placeholder-only';

function load(path, mocks) {
  const compiled = ts.transpileModule(fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}

function database() {
  const tables = { merchants: [
    { id: 'A', account_access: 'suspended', kyc_status: 'suspended', available_balance: 0 },
    { id: 'B', account_access: 'suspended', kyc_status: 'suspended', available_balance: 0 },
  ], kyc_profiles: [
    { id: 'profile-a', merchant_id: 'A', status: 'suspended', gemini_review: { didit_session_id: 'old-a' }, document_front_url: 'private/old-a' },
    { id: 'profile-b', merchant_id: 'B', status: 'suspended', gemini_review: { didit_session_id: 'old-b' } },
  ], kyc_fraud_cases: [{ id: 'case-ab', status: 'open', primary_merchant_id: 'A', related_merchant_id: 'B',
    document_match: true, primary_session_id: 'old-a', related_session_id: 'old-b', evidence: {}, created_at: '2026-01-01T00:00:00Z' }], kyc_identity_fingerprints: [] };
  const db = { tables, suspensions: [], ownerAlerts: [], async rpc(name, args) {
    assert.equal(name, 'suspend_duplicate_identity_accounts');
    this.suspensions.push(args);
    for (const merchant of tables.merchants) if ([args.p_merchant_id_a, args.p_merchant_id_b].includes(merchant.id)) {
      merchant.account_access = 'suspended'; merchant.kyc_status = 'suspended';
    }
    return { error: null, data: { success: true } };
  }, from(table) {
    tables[table] ||= [];
    const q = { filters: [], mode: 'select', one: false,
      select() { return this; }, eq(key, value) { this.filters.push(row => row[key] === value); return this; },
      neq(key, value) { this.filters.push(row => row[key] !== value); return this; },
      in(key, values) { this.filters.push(row => values.includes(row[key])); return this; },
      is(key, value) { this.filters.push(row => (row[key] ?? null) === value); return this; },
      lte(key, value) { this.filters.push(row => row[key] <= value); return this; },
      contains(key, value) { this.filters.push(row => Object.entries(value).every(([k, v]) => row[key]?.[k] === v)); return this; },
      or(value) {
        if (value.startsWith('primary_merchant_id')) this.filters.push(row => value.split(',').some(part => { const [key, , id] = part.split('.'); return row[key] === id; }));
        else if (value.startsWith('status.')) this.filters.push(row => row.status !== 'suspended');
        else this.filters.push(row => !['suspended', 'closure_pending', 'closure_pending_payout', 'closed', 'permanently_closed'].includes(row.account_access));
        return this;
      },
      update(data) { this.mode = 'update'; this.data = data; return this; },
      insert(data) { this.mode = 'insert'; this.data = data; return this; },
      upsert(data, options) { this.mode = 'upsert'; this.data = data; this.conflict = options.onConflict; return this; },
      single() { this.one = true; return this.run(); }, maybeSingle() { this.one = true; return this.run(); },
      then(resolve, reject) { return this.run().then(resolve, reject); },
      async run() {
        let rows = tables[table].filter(row => this.filters.every(filter => filter(row)));
        if (this.mode === 'update') rows.forEach(row => Object.assign(row, structuredClone(this.data)));
        if (this.mode === 'insert' || this.mode === 'upsert') {
          let row = this.mode === 'upsert' && tables[table].find(row => this.conflict.split(',').every(key => row[key] === this.data[key]));
          if (row) Object.assign(row, structuredClone(this.data));
          else { row = { id: `${table}-${tables[table].length}`, created_at: new Date().toISOString(), ...structuredClone(this.data) }; tables[table].push(row); }
          rows = [row];
        }
        return { error: null, data: this.one ? rows[0] || null : rows };
      },
    }; return q;
  } }; return db;
}

function engine(db) {
  return load('src/lib/server/kyc/fraud-engine.ts', {
    'server-only': {}, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/server/notifications': { createNotification: async (...args) => { db.ownerAlerts.push(args); return { created: true }; } }, '@/lib/kyc-resolution-policy': policy,
    '@/lib/server/kyc/ai-compliance-analyst': { AIComplianceAnalyst: { analyzeAndReport: async () => {} } },
  });
}

const document = number => ({ id_verifications: [{ document_number: number, issuing_state: 'HT', document_type: 'ID', warnings: [] }] });

async function resolvedPair() {
  const db = database(); const api = engine(db);
  const fingerprint = api.generateDocumentFingerprint('HT', 'ID', 'UNIT-DOC-001');
  db.tables.kyc_identity_fingerprints.push({ merchant_id: 'B', document_fingerprint: fingerprint, status: 'suspended', created_at: '2026-01-01T00:00:00Z' });
  await api.KycFraudEngine.resolveFraudCase({ fraudCaseId: 'case-ab', adminUserId: 'unit-admin', primaryVerdict: 'legitimate', relatedVerdict: 'confirmed_duplicate', note: 'Unit test decision' });
  return { db, api, fingerprint };
}

test('resolution isolates old verifications, requires a fresh KYC for A and closes empty B without deleting evidence', async () => {
  const { db } = await resolvedPair();
  assert.equal(db.tables.merchants[0].account_access, 'reverify_required');
  assert.equal(db.tables.merchants[0].kyc_status, 'pending_reverification');
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
  assert.equal(db.tables.merchants[1].status, 'suspended');
  assert.deepEqual(db.tables.kyc_profiles[0].gemini_review, {});
  assert.equal(db.tables.kyc_profiles[0].document_front_url, null);
  assert.equal(db.tables.kyc_identity_fingerprints[0].status, 'archived');
  assert.equal(db.tables.kyc_fraud_cases[0].evidence.resolved_identity.isolated_profiles[0].document_front_url, 'private/old-a');
});

test('A can reuse its adjudicated identity and old biometric session without suspending either account again', async () => {
  const { db, api } = await resolvedPair();
  const decision = document('UNIT-DOC-001');
  decision.id_verifications[0].warnings = [{ code: 'DUPLICATE_DOCUMENT', related_session_id: 'old-b' }];
  decision.face_matches = [{ warnings: [{ code: 'DUPLICATE_FACE', related_session_id: 'old-b' }] }];
  const result = await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'new-a', decision });
  assert.equal(result.isFraud, false);
  assert.equal(result.documentMatch, false);
  assert.equal(result.faceMatch, false);
  assert.equal(db.suspensions.length, 0);
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
});

test('unknown provider duplicate warnings stay in review rather than silently passing or repeating the resolved suspension', async () => {
  const { db, api } = await resolvedPair();
  const decision = document('UNIT-DOC-001');
  decision.id_verifications[0].warnings = ['DUPLICATE_DOCUMENT'];
  const result = await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'new-a', decision });
  assert.equal(result.actionTaken, 'placed_in_review');
  assert.equal(db.suspensions.length, 0);
});

test('a newly forged document or a new third-account match still triggers fraud controls', async () => {
  const { db, api } = await resolvedPair();
  const forged = document('UNIT-DOC-001'); forged.id_verifications[0].warnings = ['DOCUMENT_FORGERY'];
  assert.equal((await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'new-a', decision: forged })).actionTaken, 'restricted');
  const newFingerprint = api.generateDocumentFingerprint('HT', 'ID', 'UNIT-DOC-002');
  db.tables.kyc_identity_fingerprints.push({ merchant_id: 'C', document_fingerprint: newFingerprint, status: 'active' });
  db.tables.merchants.push({ id: 'C', account_access: 'active', kyc_status: 'approved' });
  const result = await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'new-a', decision: document('UNIT-DOC-002') });
  assert.equal(result.severity, 'critical');
  assert.equal(result.relatedMerchantId, 'C');
  assert.equal(db.suspensions.length, 1);
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
});

test('archived fingerprints still block an unrelated C without reopening the closed B account', async () => {
  const { db, api } = await resolvedPair();
  db.tables.merchants.push({ id: 'C', account_access: 'active', kyc_status: 'pending' });
  const result = await api.KycFraudEngine.analyzeDecision({ merchantId: 'C', sessionId: 'new-c', decision: document('UNIT-DOC-001') });
  assert.equal(result.severity, 'critical');
  assert.equal(db.suspensions[0].p_merchant_id_b, 'C');
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
});

async function establishedOwnerAndApplicant(balance = 0) {
  const context = await resolvedPair();
  await context.api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'verified-a', decision: document('UNIT-DOC-001') });
  Object.assign(context.db.tables.merchants[0], { account_access: 'active', kyc_status: 'approved', email: 'owner@example.invalid' });
  context.db.tables.merchants.push({ id: 'C', account_access: 'active', kyc_status: 'pending', available_balance_usd: balance });
  context.db.tables.kyc_profiles.push({ id: 'profile-c', merchant_id: 'C', gemini_review: { didit_session_id: 'new-c' }, status: 'pending' });
  return context;
}

test('after A is verified, exact identity reuse closes only C and alerts A without disclosing C personal data', async () => {
  const { db, api } = await establishedOwnerAndApplicant();
  const before = structuredClone(db.tables.merchants[0]);
  const result = await api.KycFraudEngine.analyzeDecision({ merchantId: 'C', sessionId: 'new-c', decision: document('UNIT-DOC-001') });
  assert.equal(result.actionTaken, 'closed_duplicate_account');
  assert.equal(result.protectedOwnerMerchantId, 'A');
  assert.deepEqual(db.tables.merchants[0], before);
  assert.equal(db.tables.merchants[2].account_access, 'permanently_closed');
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
  assert.equal(db.suspensions.length, 0);
  assert.equal(db.ownerAlerts.length, 1);
  assert.equal(db.ownerAlerts[0][0], 'A');
  assert.equal(db.ownerAlerts[0][4], 'owner@example.invalid');
  assert.match(db.ownerAlerts[0][3], /Votre compte reste actif/);
  assert.doesNotMatch(db.ownerAlerts[0][3], /UNIT-DOC|profile-c|new-c/);
  assert.equal(db.tables.kyc_fraud_cases.at(-1).status, 'confirmed_fraud');
});

test('the protected owner can reverify despite subsequent duplicate warnings, but independent forgery still restricts A', async () => {
  const { db, api } = await establishedOwnerAndApplicant();
  const own = document('UNIT-DOC-001');
  own.id_verifications[0].warnings = [{ code: 'DUPLICATE_DOCUMENT', related_session_id: 'new-c' }];
  db.tables.merchants[0].kyc_verified_at = new Date(Date.parse(db.tables.kyc_fraud_cases[0].resolved_at) + 1).toISOString();
  db.tables.merchants[0].kyc_status = 'pending';
  assert.equal((await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'retry-a', decision: own })).isFraud, false);
  assert.equal(db.tables.merchants[0].account_access, 'active');
  own.face_matches = [{ warnings: [{ code: 'DUPLICATE_FACE', related_session_id: 'new-c' }] }];
  assert.equal((await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'retry-a', decision: own })).actionTaken, 'placed_in_review');
  assert.equal(db.tables.merchants[0].account_access, 'active');
  own.id_verifications[0].warnings.push('DOCUMENT_FORGERY');
  assert.equal((await api.KycFraudEngine.analyzeDecision({ merchantId: 'A', sessionId: 'retry-a', decision: own })).actionTaken, 'restricted');
});

test('automatic duplicate closure preserves C funds, while a shared IP alone never closes C', async () => {
  const { db, api } = await establishedOwnerAndApplicant(25);
  await api.KycFraudEngine.analyzeDecision({ merchantId: 'C', sessionId: 'new-c', decision: { ip_analyses: [{ warnings: ['SHARED_IP'] }] } });
  assert.equal(db.tables.merchants[2].account_access, 'active');
  await api.KycFraudEngine.analyzeDecision({ merchantId: 'C', sessionId: 'new-c', decision: document('UNIT-DOC-001') });
  assert.equal(db.tables.merchants[2].account_access, 'closure_pending_payout');
  assert.equal(db.tables.merchants[2].available_balance_usd, 25);
  assert.equal(db.tables.merchants[0].account_access, 'active');
});

test('the webhook never sends a suspension notice to the protected owner or approves the duplicate account', async () => {
  const { db, api } = await establishedOwnerAndApplicant();
  const notices = [];
  const route = load('src/app/api/webhooks/didit/route.ts', {
    'next/server': { NextResponse: Response }, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/kyc-resolution-policy': policy, '@/lib/server/kyc/fraud-engine': api,
    '@/lib/server/plans': { activateFreePlanAfterKyc: async () => { throw new Error('Duplicate must never be approved'); } },
    '@/lib/server/notifications': { createNotification: async (...args) => { notices.push(args); }, notifyAdminKycSubmission: async () => {} },
  });
  const body = JSON.stringify({ vendor_data: 'C', session_id: 'new-c', status: 'Approved', decision: document('UNIT-DOC-001') });
  const response = await route.POST(new Request('https://kobara.example/webhook', { method: 'POST', body, headers: {
    'x-timestamp': String(Math.floor(Date.now() / 1000)),
    'x-signature': crypto.createHmac('sha256', process.env.DIDIT_WEBHOOK_SECRET).update(body).digest('hex'),
  } }));
  assert.equal(response.status, 200);
  assert.equal(db.tables.merchants[0].kyc_status, 'approved');
  assert.equal(db.tables.merchants[0].account_access, 'active');
  assert.equal(db.tables.merchants[2].account_access, 'permanently_closed');
  assert.equal(db.ownerAlerts[0][0], 'A');
  assert.equal(notices.length, 1);
  assert.equal(notices[0][0], 'C');
  assert.match(notices[0][3], /procédure de clôture/);
});

test('legacy context is restricted to the adjudicated pair, old sessions and unambiguous fingerprints', () => {
  const row = { id: 'old-case', status: 'resolved', resolved_by: 'admin', resolved_at: '2026-02-01', primary_merchant_id: 'A', related_merchant_id: 'B', primary_verdict: 'legitimate', related_verdict: 'confirmed_duplicate', document_match: true };
  const old = [{ merchant_id: 'B', document_fingerprint: 'old-hash', created_at: '2026-01-01' }];
  const contexts = policy.getResolvedIdentityContexts('A', [row], old);
  assert.equal(policy.isResolvedDocumentMatch(contexts, 'B', 'old-hash'), true);
  assert.equal(policy.isResolvedDocumentMatch(contexts, 'C', 'old-hash'), false);
  assert.equal(policy.isResolvedDocumentMatch(contexts, 'B', 'new-hash'), false);
  assert.deepEqual(policy.getResolvedIdentityContexts('B', [row], old), []);
  assert.deepEqual(policy.getResolvedIdentityContexts('A', [{ ...row, resolved_by: null }], old), []);
  const ambiguous = policy.getResolvedIdentityContexts('A', [row], [...old, { ...old[0], document_fingerprint: 'another-hash' }]);
  assert.equal(policy.isResolvedDocumentMatch(ambiguous, 'B', 'old-hash'), false);
});

test('old approvals cannot reactivate B or bypass A fresh verification', () => {
  const profile = { gemini_review: { didit_session_id: 'new-a' } };
  assert.equal(policy.canApplyKycSession({ account_access: 'permanently_closed' }, profile, 'new-a'), false);
  assert.equal(policy.canApplyKycSession({ account_access: 'reverify_required', kyc_status: 'pending_reverification' }, {}, 'old-a'), false);
  assert.equal(policy.canApplyKycSession({ account_access: 'reverify_required', kyc_status: 'pending_reverification' }, { gemini_review: { didit_session_id: 'old-a' } }, 'old-a'), false);
  assert.equal(policy.canApplyKycSession({ account_access: 'reverify_required' }, profile, 'old-a'), false);
  assert.equal(policy.canApplyKycSession({ account_access: 'reverify_required' }, profile, 'new-a'), true);
});

test('only A owner can start and persist a fresh session after administrative resolution', async t => {
  const { db } = await resolvedPair();
  let current = db.tables.merchants[1];
  let role = 'owner';
  let calls = 0;
  const originalFetch = global.fetch;
  const originalKey = process.env.DIDIT_API_KEY;
  process.env.DIDIT_API_KEY = 'unit-provider-placeholder';
  t.after(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.DIDIT_API_KEY; else process.env.DIDIT_API_KEY = originalKey; });
  global.fetch = async () => { calls++; return Response.json({ url: 'https://verification.example/unit-session', session_id: 'fresh-a' }); };
  const route = load('src/app/api/kyc/didit/session/route.ts', {
    'next/server': { NextResponse: { json: (data, options) => Response.json(data, options) } },
    '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/utils/supabase/auth-helper': { getCurrentUserAndMerchant: async () => ({ merchant: current, userRole: role }) },
    '@/lib/kyc-resolution-policy': policy,
  });
  assert.equal((await route.POST()).status, 403);
  current = db.tables.merchants[0]; role = 'developer';
  assert.equal((await route.POST()).status, 403);
  assert.equal(calls, 0);
  role = 'owner';
  assert.equal((await route.POST()).status, 200);
  assert.equal(db.tables.kyc_profiles[0].gemini_review.didit_session_id, 'fresh-a');
  assert.equal(current.kyc_status, 'pending');
  assert.equal(current.account_access, 'reverify_required');
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
});

test('an approved current webhook restores A, while stale and closed-account callbacks do nothing', async () => {
  const { db, api } = await resolvedPair();
  let activated = 0;
  const route = load('src/app/api/webhooks/didit/route.ts', {
    'next/server': { NextResponse: Response }, '@/utils/supabase/admin': { createAdminClient: () => db },
    '@/lib/kyc-resolution-policy': policy, '@/lib/server/kyc/fraud-engine': api,
    '@/lib/server/plans': { activateFreePlanAfterKyc: async () => { activated++; } },
    '@/lib/server/notifications': { createNotification: async () => {}, notifyAdminKycSubmission: async () => {} },
  });
  db.tables.kyc_profiles[0].gemini_review = { didit_session_id: 'new-a' };
  async function send(merchantId, sessionId, decision = document('UNIT-DOC-001')) {
    const body = JSON.stringify({ vendor_data: merchantId, session_id: sessionId, status: 'Approved', decision });
    return route.POST(new Request('https://kobara.example/webhook', { method: 'POST', body, headers: {
      'x-timestamp': String(Math.floor(Date.now() / 1000)),
      'x-signature': crypto.createHmac('sha256', process.env.DIDIT_WEBHOOK_SECRET).update(body).digest('hex'),
    } }));
  }
  assert.equal((await send('A', 'old-a')).status, 200);
  assert.equal((await send('B', 'old-b')).status, 200);
  assert.equal(activated, 0);
  db.tables.merchants[0].kyc_status = 'pending';
  assert.equal((await send('A', 'new-a')).status, 200);
  assert.equal(db.tables.merchants[0].account_access, 'active');
  assert.equal(db.tables.merchants[0].kyc_status, 'approved');
  assert.equal(db.tables.merchants[1].account_access, 'permanently_closed');
  assert.equal(activated, 1);
  db.tables.kyc_profiles[0].gemini_review = { didit_session_id: 'fraud-session' };
  const forged = document('UNIT-DOC-001'); forged.id_verifications[0].warnings = ['DOCUMENT_FORGERY'];
  await send('A', 'fraud-session', forged);
  assert.equal(db.tables.merchants[0].account_access, 'restricted');
  assert.equal(db.tables.merchants[0].kyc_status, 'in_review');
  assert.equal(activated, 1);
});

test('a duplicate account with remaining USD funds stays restricted for restitution, never silently emptied', async () => {
  const db = database(); db.tables.merchants[1].available_balance_usd = 25;
  await engine(db).KycFraudEngine.resolveFraudCase({ fraudCaseId: 'case-ab', adminUserId: 'unit-admin', primaryVerdict: 'legitimate', relatedVerdict: 'fraudulent', note: 'Unit test' });
  assert.equal(db.tables.merchants[1].account_access, 'closure_pending_payout');
  assert.equal(db.tables.merchants[1].available_balance_usd, 25);
});
