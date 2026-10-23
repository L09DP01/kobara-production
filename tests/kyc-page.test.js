import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = fs.readFileSync(new URL('../src/app/dashboard/kyc/page.tsx', import.meta.url), 'utf8');

async function renderPage(merchant, profile = null, userRole = 'owner') {
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const mocks = {
    './actions': { getKycStatus: async () => profile },
    '@/utils/supabase/auth-helper': { getCurrentUserAndMerchant: async () => ({ merchant, userRole }) },
    'next/navigation': { redirect: () => { throw new Error('redirect'); } },
    '@/components/kyc/DiditVerificationButton': {
      DiditVerificationButton: ({ buttonText }) => React.createElement('button', { 'data-kyc-start': true }, buttonText),
    },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled.outputText)(
    name => name in mocks ? mocks[name] : require(name), module, module.exports,
  );
  return renderToStaticMarkup(await module.exports.default());
}

test('admin-unblocked accounts show a new verification instead of an empty page', async () => {
  for (const profileStatus of ['pending', 'approved', 'rejected']) {
    const html = await renderPage({ account_access: 'reverify_required', kyc_status: 'pending_reverification' }, { status: profileStatus });
    assert.match(html, /Nouvelle vérification d&#x27;identité requise/);
    assert.match(html, /Revérifier mon identité/);
    assert.match(html, /data-kyc-start/);
    assert.doesNotMatch(html, /Compte vérifié avec succès|Vérification en cours d&#x27;examen/);
  }
});

test('an old approved profile never overrides required reverification', async () => {
  const html = await renderPage({ account_access: 'reverify_required', kyc_status: 'approved' }, { status: 'approved' });
  assert.match(html, /Revérifier mon identité/);
  assert.doesNotMatch(html, /Compte vérifié avec succès/);
});

test('a newly submitted reverification stays in review until validation', async () => {
  for (const status of ['pending', 'in_review']) {
    const html = await renderPage({ account_access: 'reverify_required', kyc_status: status }, { status: 'approved' });
    assert.match(html, /Vérification en cours d&#x27;examen/);
    assert.doesNotMatch(html, /Compte vérifié avec succès|Revérifier mon identité/);
  }
});

test('suspended and closed accounts cannot start verification from this page', async () => {
  for (const access of ['suspended', 'closure_pending', 'closure_pending_payout', 'closed', 'permanently_closed']) {
    const html = await renderPage({ account_access: access, kyc_status: 'suspended' }, { status: 'approved' });
    assert.match(html, /restriction/);
    assert.doesNotMatch(html, /data-kyc-start|Compte vérifié avec succès/);
  }
});

test('initial, rejected and unknown states always have a verification action', async () => {
  for (const status of ['not_started', 'rejected', 'needs_input', undefined]) {
    assert.match(await renderPage({ kyc_status: status }), /Lancer la vérification d&#x27;identité/);
  }
});

test('new approval restores the approved screen and members remain excluded', async () => {
  assert.match(await renderPage({ account_access: 'active', kyc_status: 'approved' }, { status: 'approved' }), /Compte vérifié avec succès/);
  const member = await renderPage({ account_access: 'reverify_required', kyc_status: 'pending_reverification' }, null, 'developer');
  assert.match(member, /Accès restreint/);
  assert.doesNotMatch(member, /data-kyc-start/);
});

test('additional business reuses its owner identity and displays activity review instead of a new identity submission', async () => {
  for (const status of ['pending', 'approved', 'rejected']) {
    const html = await renderPage({ identity_owner_merchant_id: 'owner-business', business_name: 'Academie Express',
      business_verification_status: status, kyc_status: status === 'approved' ? 'approved' : 'in_review',
      business_review_json: { description: 'Formation et services numeriques' } });
    assert.match(html, /Validation de l’activité/);
    assert.match(html, /Aucune nouvelle pièce d’identité/);
    assert.doesNotMatch(html, /data-kyc-start|Lancer la vérification/);
  }
});
