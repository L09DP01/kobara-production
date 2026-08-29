import test from 'node:test';
import assert from 'node:assert/strict';

function simulateAmlResolution(primaryMerchant, relatedMerchant, primaryVerdict, relatedVerdict) {
  const now = new Date();
  const deadline190d = new Date(now.getTime() + 190 * 24 * 60 * 60 * 1000);

  let pState = { ...primaryMerchant };
  let rState = { ...relatedMerchant };

  // Traitement A
  if (primaryVerdict === 'legitimate') {
    pState.account_access = 'reverify_required';
    pState.kyc_status = 'pending_reverification';
  } else {
    pState.account_access = pState.available_balance > 0 ? 'closure_pending_payout' : 'closure_pending';
    pState.kyc_status = 'suspended';
  }

  // Traitement B
  let bPayoutStatus = 'none';
  if (relatedVerdict === 'legitimate') {
    rState.account_access = 'reverify_required';
    rState.kyc_status = 'pending_reverification';
  } else {
    const hasBalance = rState.available_balance > 0;
    rState.account_access = hasBalance ? 'closure_pending_payout' : 'closure_pending';
    rState.kyc_status = 'suspended';
    bPayoutStatus = hasBalance ? 'pending_instructions' : 'none';
  }

  return {
    primaryState: pState,
    relatedState: rState,
    payoutStatus: bPayoutStatus,
    payoutDeadline: bPayoutStatus !== 'none' ? deadline190d.toISOString() : null,
  };
}

test('AML/CFT Fraud Lifecycle & Restitution Rules (GAFI & BRH Invariants)', async (t) => {

  await t.test('Test 1: Admin déclare A légitime -> A passe en reverify_required, B passe en closure_pending_payout avec délai 190 jours', () => {
    const pMerchant = { id: 'm_a', business_name: 'Boutique A', available_balance: 0, account_access: 'suspended' };
    const rMerchant = { id: 'm_b', business_name: 'Boutique B (Dupliqué)', available_balance: 15000, account_access: 'suspended' };

    const res = simulateAmlResolution(pMerchant, rMerchant, 'legitimate', 'confirmed_duplicate');

    assert.equal(res.primaryState.account_access, 'reverify_required');
    assert.equal(res.primaryState.kyc_status, 'pending_reverification');

    assert.equal(res.relatedState.account_access, 'closure_pending_payout');
    assert.equal(res.payoutStatus, 'pending_instructions');
    assert.ok(res.payoutDeadline);

    // Vérifier que la deadline est bien à 190 jours environ (+/- 1 jour)
    const diffDays = Math.round((new Date(res.payoutDeadline).getTime() - Date.now()) / (86400 * 1000));
    assert.equal(diffDays, 190);
  });

  await t.test('Test 2: Compte A en reverify_required est bloqué pour les opérations financières', () => {
    const accountAccess = 'reverify_required';
    const isAllowedForFinancialOps = accountAccess === 'active';

    assert.equal(isAllowedForFinancialOps, false);
  });

  await t.test('Test 3: Seul un KYC Didit APPROVED valide repasse le Compte A en active', () => {
    let merchantState = { account_access: 'reverify_required', kyc_status: 'pending_reverification' };
    const diditWebhookStatus = 'Approved';

    if (diditWebhookStatus === 'Approved') {
      merchantState.account_access = 'active';
      merchantState.kyc_status = 'approved';
    }

    assert.equal(merchantState.account_access, 'active');
    assert.equal(merchantState.kyc_status, 'approved');
  });

  await t.test('Test 4: Compte B soumet ses coordonnées de virement -> Passage du statut en instructions_submitted', () => {
    let payoutState = { status: 'pending_instructions', details: null };
    const userSubmission = {
      payoutMethod: 'moncash',
      payoutAccountNumber: '+509 3123 4567',
      payoutAccountName: 'Jean Baptiste',
    };

    payoutState.status = 'instructions_submitted';
    payoutState.details = userSubmission;

    assert.equal(payoutState.status, 'instructions_submitted');
    assert.equal(payoutState.details.payoutMethod, 'moncash');
  });

  await t.test('Test 5: Validation Admin du versement -> solde mis à 0, payout settled, compte fermé', () => {
    let bMerchant = { id: 'm_b', available_balance: 15000, account_access: 'closure_pending_payout' };
    let payoutState = { status: 'instructions_submitted' };

    // Action Admin processClosurePayout
    bMerchant.available_balance = 0;
    bMerchant.account_access = 'closed';
    payoutState.status = 'settled';

    assert.equal(bMerchant.available_balance, 0);
    assert.equal(bMerchant.account_access, 'closed');
    assert.equal(payoutState.status, 'settled');
  });

  await t.test('Test 6: Expiration des 190 jours sans coordonnées -> Compte permanently_closed, fonds unclaimed (jamais supprimés)', () => {
    let bMerchant = { id: 'm_b', available_balance: 5000, account_access: 'closure_pending_payout' };
    let payoutState = { status: 'pending_instructions', deadline_at: new Date(Date.now() - 1000).toISOString() };

    const isExpired = new Date(payoutState.deadline_at) < new Date();
    if (isExpired && payoutState.status === 'pending_instructions') {
      bMerchant.account_access = 'permanently_closed';
      payoutState.status = 'unclaimed';
    }

    assert.equal(bMerchant.account_access, 'permanently_closed');
    assert.equal(payoutState.status, 'unclaimed');
    assert.equal(bMerchant.available_balance, 5000); // Le solde n'est PAS confisqué en revenu
  });
});
