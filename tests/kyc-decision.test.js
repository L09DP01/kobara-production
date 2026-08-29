import test from 'node:test';
import assert from 'node:assert/strict';
import { decideKycStatus } from '../src/lib/server/kyc/decision-engine.ts';

test('KYC Decision Engine: Strict Invariants', async (t) => {
  await t.test('approves automatically only when score is high (>=85) and no signals are missing', () => {
    const perfectSignals = {
      email_verified: true,
      phone_verified: true,
      document_type: 'passport',
      document_required_sides_present: true,
      document_quality_score: 95,
      document_expired: false,
      ocr_score: 90,
      name_match_score: 95,
      selfie_present: true,
      face_detected: true,
      face_match_score: 95,
      liveness_score: 95,
      duplicate_document: false,
      duplicate_phone: false,
      duplicate_selfie: false,
      risk_score: 0,
      gemini_review: {
        risk_level: 'low',
        recommended_status: 'approved',
      }
    };

    const decision = decideKycStatus(perfectSignals);
    assert.equal(decision.status, 'approved');
    assert.ok(decision.score >= 85);
  });

  await t.test('NEVER rejects automatically: missing selfie transitions to in_review (manual review)', () => {
    const signals = {
      email_verified: true,
      phone_verified: true,
      document_type: 'national_id',
      document_required_sides_present: true,
      document_quality_score: 80,
      document_expired: false,
      ocr_score: 80,
      name_match_score: 80,
      selfie_present: false, // Missing selfie
      face_detected: false,
      face_match_score: 0,
      liveness_score: 0,
      duplicate_document: false,
      duplicate_phone: false,
      duplicate_selfie: false,
      risk_score: 10,
      gemini_review: {}
    };

    const decision = decideKycStatus(signals);
    assert.notEqual(decision.status, 'rejected', 'Decision engine must NEVER return rejected automatically');
    assert.equal(decision.status, 'in_review');
    assert.ok(decision.reasons.some(r => r.includes('Selfie manquant')));
  });

  await t.test('NEVER rejects automatically: when AI flags an inconsistency or recommended_status is rejected, fallback to in_review', () => {
    const signals = {
      email_verified: true,
      phone_verified: true,
      document_type: 'national_id',
      document_required_sides_present: true,
      document_quality_score: 40,
      document_expired: false,
      ocr_score: 30,
      name_match_score: 30,
      selfie_present: true,
      face_detected: true,
      face_match_score: 40,
      liveness_score: 30,
      duplicate_document: false,
      duplicate_phone: false,
      duplicate_selfie: false,
      risk_score: 80,
      gemini_review: {
        risk_level: 'critical',
        recommended_status: 'rejected',
        observations: ['Document blur', 'Face mismatch']
      }
    };

    const decision = decideKycStatus(signals);
    assert.notEqual(decision.status, 'rejected', 'Decision engine must NEVER reject automatically');
    assert.equal(decision.status, 'in_review', 'Must transition to in_review for human compliance check');
  });
});
