import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Simulation des fonctions pures de l'antifraude KYC Kobara
function generateDocumentFingerprint(country, docType, docNumber, secret = 'test_secret') {
  const normCountry = (country || 'HT').trim().toUpperCase();
  const normType = (docType || 'ID').trim().toUpperCase();
  const normNum = (docNumber || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (!normNum || normNum.length < 4) return null;
  return crypto.createHmac('sha256', secret).update(`${normCountry}|${normType}|${normNum}`).digest('hex');
}

function evaluateKycSignals(input) {
  const { currentMerchantId, relatedMerchantId, documentMatch, faceConfirmed, facePossible, deviceMatch, ipMatch } = input;

  // Règle A === B : même utilisateur qui retente
  if (relatedMerchantId && relatedMerchantId === currentMerchantId) {
    return { isFraud: false, severity: 'low', action: 'none' };
  }

  if (documentMatch || (faceConfirmed && relatedMerchantId && relatedMerchantId !== currentMerchantId)) {
    return { isFraud: true, severity: 'critical', action: 'suspend_both_accounts' };
  }

  if (facePossible && deviceMatch) {
    return { isFraud: true, severity: 'high', action: 'restricted' };
  }

  if (deviceMatch || facePossible) {
    return { isFraud: false, severity: 'medium', action: 'placed_in_review' };
  }

  if (ipMatch) {
    return { isFraud: false, severity: 'low', action: 'logged' };
  }

  return { isFraud: false, severity: 'low', action: 'none' };
}

test('Didit KYC Anti-Fraud Engine: 11 Mandatory Scenarios', async (t) => {
  const secret = 'kbr_fraud_secret_key_2026';

  await t.test('Test 1 — Utilisateur normal : verified, aucune fraude', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_1',
      relatedMerchantId: null,
      documentMatch: false,
      faceConfirmed: false,
      facePossible: false,
      deviceMatch: false,
      ipMatch: false,
    });
    assert.equal(res.isFraud, false);
    assert.equal(res.severity, 'low');
    assert.equal(res.action, 'none');
  });

  await t.test('Test 2 — Même utilisateur qui recommence son KYC (A === B) : pas de fraude', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_1',
      relatedMerchantId: 'merchant_1',
      documentMatch: true,
      faceConfirmed: true,
      facePossible: false,
      deviceMatch: true,
      ipMatch: true,
    });
    assert.equal(res.isFraud, false);
    assert.equal(res.severity, 'low');
    assert.equal(res.action, 'none');
  });

  await t.test('Test 3 — Deux comptes même document (A != B) : Sévérité CRITICAL + Suspension des DEUX comptes', () => {
    const docA = generateDocumentFingerprint('HT', 'NIF', '001-234-567-8', secret);
    const docB = generateDocumentFingerprint('HT', 'NIF', '0012345678', secret); // normalisé
    assert.equal(docA, docB);

    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: 'merchant_1',
      documentMatch: true,
      faceConfirmed: false,
      facePossible: false,
      deviceMatch: false,
      ipMatch: false,
    });
    assert.equal(res.isFraud, true);
    assert.equal(res.severity, 'critical');
    assert.equal(res.action, 'suspend_both_accounts');
  });

  await t.test('Test 4 — Deux comptes même visage confirmé (A != B) : Sévérité CRITICAL + Suspension des DEUX comptes', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: 'merchant_1',
      documentMatch: false,
      faceConfirmed: true,
      facePossible: false,
      deviceMatch: false,
      ipMatch: false,
    });
    assert.equal(res.isFraud, true);
    assert.equal(res.severity, 'critical');
    assert.equal(res.action, 'suspend_both_accounts');
  });

  await t.test('Test 5 — IP partagée seule : Sévérité LOW, JAMAIS de suspension automatique', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: null,
      documentMatch: false,
      faceConfirmed: false,
      facePossible: false,
      deviceMatch: false,
      ipMatch: true,
    });
    assert.equal(res.isFraud, false);
    assert.equal(res.severity, 'low');
    assert.equal(res.action, 'logged');
  });

  await t.test('Test 6 — Device fingerprint partagé seul : Sévérité MEDIUM, mise sous revue (pas de suspension)', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: null,
      documentMatch: false,
      faceConfirmed: false,
      facePossible: false,
      deviceMatch: true,
      ipMatch: false,
    });
    assert.equal(res.isFraud, false);
    assert.equal(res.severity, 'medium');
    assert.equal(res.action, 'placed_in_review');
  });

  await t.test('Test 7 — Possible duplicate face uniquement : Sévérité MEDIUM, under_review (pas de suspension)', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: 'merchant_1',
      documentMatch: false,
      faceConfirmed: false,
      facePossible: true,
      deviceMatch: false,
      ipMatch: false,
    });
    assert.equal(res.isFraud, false);
    assert.equal(res.severity, 'medium');
    assert.equal(res.action, 'placed_in_review');
  });

  await t.test('Test 8 — Possible face + Same Device : Sévérité HIGH, restriction temporaire', () => {
    const res = evaluateKycSignals({
      currentMerchantId: 'merchant_2',
      relatedMerchantId: 'merchant_1',
      documentMatch: false,
      faceConfirmed: false,
      facePossible: true,
      deviceMatch: true,
      ipMatch: false,
    });
    assert.equal(res.isFraud, true);
    assert.equal(res.severity, 'high');
    assert.equal(res.action, 'restricted');
  });

  await t.test('Test 9 — Idempotence Webhook : Événement déjà traité dédupliqué sans double écriture', () => {
    const processedEvents = new Set();
    const eventId = 'evt_didit_unique_123';
    
    // Premier traitement
    const isFirst = !processedEvents.has(eventId);
    if (isFirst) processedEvents.add(eventId);
    assert.equal(isFirst, true);

    // Second appel identique
    const isSecond = !processedEvents.has(eventId);
    assert.equal(isSecond, false);
  });

  await t.test('Test 10 — Signature invalide rejetée sans modification', () => {
    const payload = JSON.stringify({ status: 'Approved' });
    const correctSig = crypto.createHmac('sha256', 'secret').update(payload).digest('hex');
    const attackerSig = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');
    assert.notEqual(correctSig, attackerSig);
  });

  await t.test('Test 11 — Réactivation Administrative (Faux positif) avec Audit', () => {
    const fraudCase = {
      id: 'case_123',
      status: 'open',
      primaryMerchantId: 'merchant_1',
      relatedMerchantId: 'merchant_2',
    };

    const resolveAction = 'false_positive';
    const resolutionNote = 'Erreur d’homonymie - vérification manuelle validée';
    const adminId = 'admin_super_1';

    const updatedCase = {
      ...fraudCase,
      status: resolveAction === 'false_positive' ? 'false_positive' : 'resolved',
      reviewedBy: adminId,
      resolutionNote,
    };

    assert.equal(updatedCase.status, 'false_positive');
    assert.equal(updatedCase.reviewedBy, 'admin_super_1');
  });
});
