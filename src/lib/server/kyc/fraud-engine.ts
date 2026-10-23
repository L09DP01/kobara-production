import 'server-only';

import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { createNotification } from '@/lib/server/notifications';
import { getResolvedIdentityContexts, isResolvedDocumentMatch, isResolvedSessionMatch } from '@/lib/kyc-resolution-policy';

export type KycFraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface KycFraudSignal {
  source: 'identity' | 'face' | 'liveness' | 'device' | 'ip';
  code: string;
  severity: KycFraudSeverity;
  description: string;
  relatedSessionId?: string;
  relatedMerchantId?: string;
  metadata?: Record<string, unknown>;
}

export interface KycFraudAnalysisResult {
  isFraud: boolean;
  severity: KycFraudSeverity;
  score: number;
  signals: KycFraudSignal[];
  primaryMerchantId: string;
  relatedMerchantId: string | null;
  documentMatch: boolean;
  faceMatch: boolean;
  deviceMatch: boolean;
  ipMatch: boolean;
  actionTaken: 'none' | 'logged' | 'placed_in_review' | 'restricted' | 'suspended_both_accounts' | 'suspended_current_account' | 'closed_duplicate_account';
  protectedOwnerMerchantId?: string;
  fraudCaseId?: string;
  rejectionReason?: string;
}

/**
 * Génère une empreinte HMAC-SHA256 normalisée et cryptographique pour une pièce d'identité.
 * Ne stocke pas le numéro de document en clair pour la recherche de doublons.
 */
export function generateDocumentFingerprint(
  country?: string | null,
  documentType?: string | null,
  documentNumber?: string | null
): string | null {
  const normCountry = (country || 'HT').trim().toUpperCase();
  const normType = (documentType || 'ID').trim().toUpperCase();
  const normNum = (documentNumber || '').trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  if (!normNum || normNum.length < 4) {
    return null;
  }

  const secret = process.env.KYC_IDENTITY_FINGERPRINT_SECRET
    || process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('KYC_IDENTITY_FINGERPRINT_SECRET is not configured.');
  }

  const rawIdentity = `${normCountry}|${normType}|${normNum}`;
  return crypto.createHmac('sha256', secret).update(rawIdentity).digest('hex');
}

/**
 * Moteur Antifraude KYC Central de Kobara
 */
export class KycFraudEngine {
  /**
   * Analyse complète des avertissements et signaux de fraude Didit
   */
  static async analyzeDecision(input: {
    merchantId: string;
    sessionId: string;
    decision: any;
  }): Promise<KycFraudAnalysisResult> {
    const supabase = createAdminClient();
    const { merchantId, sessionId, decision } = input;
    const resolvedCases = await supabase.from('kyc_fraud_cases').select('*')
      .or(`primary_merchant_id.eq.${merchantId},related_merchant_id.eq.${merchantId}`)
      .in('status', ['resolved', 'false_positive']);
    if (resolvedCases.error) throw new Error('kyc_resolution_lookup_failed');
    const relatedIds = [...new Set([merchantId, ...(resolvedCases.data || []).flatMap((row: any) => [row.primary_merchant_id, row.related_merchant_id]).filter(Boolean)])];
    const historical = await supabase.from('kyc_identity_fingerprints')
      .select('merchant_id, document_fingerprint, created_at').in('merchant_id', relatedIds);
    if (historical.error) throw new Error('kyc_identity_history_lookup_failed');
    const previousProfiles = await supabase.from('kyc_profiles')
      .select('merchant_id, gemini_review, metadata, updated_at').in('merchant_id', relatedIds);
    if (previousProfiles.error) throw new Error('kyc_session_history_lookup_failed');
    const resolvedContexts = getResolvedIdentityContexts(merchantId, resolvedCases.data || [], historical.data || [], previousProfiles.data || []);

    const signals: KycFraudSignal[] = [];
    let riskScore = 0;
    let documentMatch = false;
    let faceMatch = false;
    let deviceMatch = false;
    let ipMatch = false;
    let relatedMerchantId: string | null = null;
    let relatedSessionId: string | null = null;
    let establishedOwner: { id: string; email?: string } | null = null;

    // --- 1. Extraction et Analyse Documentaire (Fingerprint) ---
    const idVerifications = Array.isArray(decision?.id_verifications) ? decision.id_verifications : [];
    let currentDocFingerprint: string | null = null;
    let docCountry = 'HT';
    let docType = 'ID';

    for (const idv of idVerifications) {
      docCountry = idv.issuing_state || idv.issuing_country || idv.nationality || 'HT';
      docType = idv.document_type || 'ID';
      const docNumber = idv.document_number || idv.personal_number;

      if (docNumber) {
        currentDocFingerprint = generateDocumentFingerprint(docCountry, docType, docNumber);
      }

      // Analyse des warnings Didit sur le document
      const warnings = Array.isArray(idv.warnings) ? idv.warnings : [];
      for (const w of warnings) {
        const code = String(w.code || w.name || w || '').toUpperCase();
        if (code.includes('DUPLICATE') || code.includes('REUSED_DOCUMENT') || code.includes('MATCHED_USER')) {
          const previousSession = w.related_session_id || w.matched_session_id;
          if (currentDocFingerprint && resolvedContexts.some(context =>
            context.fingerprints.includes(currentDocFingerprint!) && context.sessionIds.includes(previousSession))) continue;
          signals.push({
            source: 'identity',
            code,
            severity: 'critical',
            description: 'Didit signale un document déjà utilisé sur un autre dossier.',
            relatedSessionId: w.related_session_id || w.matched_session_id,
          });
          riskScore += 100;
          documentMatch = true;
        } else if (code.includes('SUSPECT') || code.includes('FRAUD') || code.includes('ALTERED') || code.includes('FORGERY')) {
          signals.push({
            source: 'identity',
            code,
            severity: 'high',
            description: 'Document suspect ou altéré détecté.',
          });
          riskScore += 60;
        } else if (code.includes('BLOCKLIST')) {
          signals.push({
            source: 'identity',
            code,
            severity: 'critical',
            description: 'Document présent dans une liste de blocage de sécurité.',
          });
          riskScore += 100;
        }
      }
    }

    // Protection Kobara Indépendante : Recherche de la même empreinte de document dans notre base
    if (currentDocFingerprint) {
      const { data: existingFingerprints, error: fingerprintError } = await supabase
        .from('kyc_identity_fingerprints')
        .select('merchant_id, status, document_fingerprint, created_at')
        .eq('document_fingerprint', currentDocFingerprint)
        .neq('merchant_id', merchantId);
      if (fingerprintError) throw new Error('kyc_fingerprint_lookup_failed');
      // Archived fraud evidence still protects other merchants; only this adjudicated pair is excluded.
      let existingFingerprint = (existingFingerprints || []).find((row: any) =>
        !isResolvedDocumentMatch(resolvedContexts, row.merchant_id, currentDocFingerprint!));
      if (existingFingerprints?.length) {
        const candidates = [...new Set([merchantId, ...existingFingerprints.map((row: any) => row.merchant_id)])];
        const ownerCases = await supabase.from('kyc_fraud_cases').select('*')
          .or(candidates.flatMap(id => [`primary_merchant_id.eq.${id}`, `related_merchant_id.eq.${id}`]).join(','))
          .in('status', ['resolved', 'false_positive']);
        if (ownerCases.error) throw new Error('kyc_identity_owner_lookup_failed');
        const possibleOwners = [...new Set((ownerCases.data || []).flatMap((row: any) => [row.primary_merchant_id, row.related_merchant_id]).filter(Boolean))];
        const ownerIds = possibleOwners.filter(id => getResolvedIdentityContexts(id, ownerCases.data || [], existingFingerprints)
          .some(context => context.fingerprints.includes(currentDocFingerprint!)));
        const ownerRows = ownerIds.length ? await supabase.from('merchants')
          .select('id, email, status, account_access, kyc_status, kyc_verified_at').in('id', ownerIds)
          .eq('account_access', 'active') : { data: [], error: null };
        if (ownerRows.error) throw new Error('kyc_verified_owner_lookup_failed');
        const verifiedOwners = (ownerRows.data || []).filter((row: any) => {
          if (row.status === 'suspended' || ['suspended', 'pending_reverification'].includes(row.kyc_status)) return false;
          const verifiedAt = Date.parse(row.kyc_verified_at);
          const confirmedSinceResolution = Number.isFinite(verifiedAt) && getResolvedIdentityContexts(row.id, ownerCases.data || [], existingFingerprints)
            .some(context => context.fingerprints.includes(currentDocFingerprint!) && (ownerCases.data || [])
              .some((resolved: any) => resolved.id === context.caseId && Date.parse(resolved.resolved_at) <= verifiedAt));
          return row.kyc_status === 'approved' || confirmedSinceResolution;
        });
        if (verifiedOwners.length === 1) establishedOwner = verifiedOwners[0];
        if (establishedOwner?.id === merchantId || verifiedOwners.length > 1) {
          existingFingerprint = undefined;
          documentMatch = false;
          for (let index = signals.length - 1; index >= 0; index--) {
            const signal = signals[index];
            if (signal.source === 'identity' && /DUPLICATE|REUSED_DOCUMENT|MATCHED_USER/.test(signal.code)) {
              riskScore -= 100;
              signals.splice(index, 1);
            }
          }
          if (verifiedOwners.length > 1) {
            signals.push({ source: 'identity', code: 'IDENTITY_OWNERSHIP_REVIEW', severity: 'high', description: 'Plusieurs décisions de propriété nécessitent une revue du compte demandeur.' });
            riskScore += 60;
          }
        }
      }

      if (existingFingerprint) {
        documentMatch = true;
        relatedMerchantId = establishedOwner?.id || existingFingerprint.merchant_id;
        signals.push({
          source: 'identity',
          code: 'SAME_DOCUMENT_EXACT_MATCH',
          severity: 'critical',
          description: `Même pièce d'identité utilisée sur un autre compte marchand (${existingFingerprint.merchant_id}).`,
          relatedMerchantId: relatedMerchantId || undefined,
        });
        riskScore += 100;
      } else if (resolvedContexts.some(context => context.fingerprints.includes(currentDocFingerprint!))) {
        // An unscoped provider warning is not proof of a new conflicting account.
        // Keep it for manual review instead of repeating a resolved dual suspension.
        for (const signal of signals) {
          if (signal.source === 'identity' && signal.severity === 'critical' && !signal.relatedSessionId
            && /DUPLICATE|REUSED_DOCUMENT|MATCHED_USER/.test(signal.code)) {
            signal.severity = 'medium';
            signal.description = 'Doublon documentaire sans session liée : vérifier le dossier administratif déjà résolu.';
            riskScore -= 60;
          }
        }
        documentMatch = signals.some(signal => signal.source === 'identity' && signal.severity === 'critical'
          && /DUPLICATE|REUSED_DOCUMENT|MATCHED_USER/.test(signal.code));
      }
    }

    // --- 2. Extraction et Analyse Biométrique (Face Match / Liveness) ---
    const faceMatches = Array.isArray(decision?.face_matches) ? decision.face_matches : [];
    const livenessChecks = Array.isArray(decision?.liveness_checks) ? decision.liveness_checks : [];

    for (const fm of faceMatches) {
      const warnings = Array.isArray(fm.warnings) ? fm.warnings : [];
      for (const w of warnings) {
        const code = String(w.code || w.name || w || '').toUpperCase();
        const isConfirmed = code.includes('CONFIRMED') || code.includes('DUPLICATE_FACE') || code.includes('MATCHED_FACE');
        const isPossible = code.includes('POSSIBLE') || code.includes('POTENTIAL') || code.includes('LIKELY');

        const relSession = w.related_session_id || w.matched_session_id;
        if ((isConfirmed || isPossible) && isResolvedSessionMatch(resolvedContexts, relSession)) continue;
        if (relSession) relatedSessionId = relSession;

        if (isConfirmed) {
          if (establishedOwner?.id === merchantId) {
            signals.push({ source: 'face', code: 'NEW_FACE_MATCH_REVIEW', severity: 'medium',
              description: 'Nouvelle correspondance biométrique à examiner sans suspendre le propriétaire pour un doublon documentaire.', relatedSessionId: relSession });
            riskScore += 40;
            continue;
          }
          signals.push({
            source: 'face',
            code,
            severity: 'critical',
            description: 'Correspondance biométrique faciale confirmée avec une autre session.',
            relatedSessionId: relSession,
          });
          riskScore += 100;
          faceMatch = true;
        } else if (isPossible) {
          signals.push({
            source: 'face',
            code,
            severity: 'medium',
            description: 'Possible similarité faciale détectée (revue manuelle requise).',
            relatedSessionId: relSession,
          });
          riskScore += 40;
        }
      }
    }

    // --- 3. Analyse Device Fingerprint & IP ---
    const deviceAnalyses = Array.isArray(decision?.device_analyses) ? decision.device_analyses : [];
    const ipAnalyses = Array.isArray(decision?.ip_analyses) ? decision.ip_analyses : [];

    for (const dev of deviceAnalyses) {
      const warnings = Array.isArray(dev.warnings) ? dev.warnings : [];
      for (const w of warnings) {
        const code = String(w.code || w.name || w || '').toUpperCase();
        if (code.includes('DUPLICATE_DEVICE') || code.includes('REUSED_DEVICE')) {
          deviceMatch = true;
          signals.push({
            source: 'device',
            code,
            severity: 'medium',
            description: 'Appareil partagé avec un autre compte.',
          });
          riskScore += 25;
        }
      }
    }

    for (const ip of ipAnalyses) {
      const warnings = Array.isArray(ip.warnings) ? ip.warnings : [];
      for (const w of warnings) {
        const code = String(w.code || w.name || w || '').toUpperCase();
        if (code.includes('DUPLICATE_IP') || code.includes('SHARED_IP')) {
          ipMatch = true;
          signals.push({
            source: 'ip',
            code,
            severity: 'low',
            description: 'Adresse IP partagée détectée (signal indicatif).',
          });
          riskScore += 10;
        }
      }
    }

    // Si Didit a retourné une session liée, tentons de retrouver le marchand Kobara associé
    if (relatedSessionId && !relatedMerchantId) {
      const { data: linkedProfile } = await supabase
        .from('kyc_profiles')
        .select('merchant_id')
        .contains('metadata', { didit_session_id: relatedSessionId })
        .maybeSingle();

      if (linkedProfile && linkedProfile.merchant_id !== merchantId) {
        relatedMerchantId = linkedProfile.merchant_id;
      }
    }

    // --- 4. Règle clé : Même utilisateur qui recommence son propre KYC (A === B) ---
    if (relatedMerchantId && relatedMerchantId === merchantId) {
      // C'est le même utilisateur qui retente ou met à jour son KYC : ce n'est PAS un doublon frauduleux !
      return {
        isFraud: false,
        severity: 'low',
        score: 0,
        signals: [],
        primaryMerchantId: merchantId,
        relatedMerchantId: null,
        documentMatch: false,
        faceMatch: false,
        deviceMatch: false,
        ipMatch: false,
        actionTaken: 'none',
      };
    }

    // --- 5. Détermination de la Sévérité Globale ---
    let overallSeverity: KycFraudSeverity = 'low';
    let isFraud = false;

    const hasCriticalSignal = signals.some(s => s.severity === 'critical') || documentMatch || (faceMatch && relatedMerchantId);
    const hasHighSignal = signals.some(s => s.severity === 'high') || (deviceMatch && signals.some(s => s.source === 'face'));
    const hasMediumSignal = signals.some(s => s.severity === 'medium') || deviceMatch;

    if (hasCriticalSignal) {
      overallSeverity = 'critical';
      isFraud = true;
    } else if (hasHighSignal) {
      overallSeverity = 'high';
      isFraud = true;
    } else if (hasMediumSignal) {
      overallSeverity = 'medium';
    } else if (signals.length > 0) {
      overallSeverity = 'low';
    }

    // --- 6. Enregistrement de l'empreinte si le document est valide et non conflictuel ---
    if (currentDocFingerprint && !documentMatch) {
      await supabase.from('kyc_identity_fingerprints').upsert({
        merchant_id: merchantId,
        document_fingerprint: currentDocFingerprint,
        country_code: docCountry,
        document_type: docType,
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'document_fingerprint,merchant_id' });
    }

    // --- 7. Exécution des Actions selon la Sévérité ---
    let actionTaken: KycFraudAnalysisResult['actionTaken'] = 'none';
    let fraudCaseId: string | undefined;

    if (overallSeverity === 'critical') {
      // 1. Création du cas de fraude
      const caseType = documentMatch ? 'duplicate_document' : faceMatch ? 'duplicate_face' : 'multi_signal';
      const reasonCodes = signals.map(s => s.code);
      const reasonDesc = signals.map(s => s.description).join(' | ');

      const { data: newCase, error: caseInsertError } = await supabase
        .from('kyc_fraud_cases')
        .insert({
          case_type: caseType,
          severity: 'critical',
          status: 'open',
          primary_merchant_id: merchantId,
          related_merchant_id: relatedMerchantId,
          primary_session_id: sessionId,
          related_session_id: relatedSessionId,
          document_match: documentMatch,
          face_match: faceMatch,
          device_match: deviceMatch,
          ip_match: ipMatch,
          risk_score: riskScore,
          reason_codes: reasonCodes,
          evidence: { signals, decision_summary: decision?.status, document_fingerprint: currentDocFingerprint },
          action_taken: 'pending_suspension',
        })
        .select('id')
        .single();
      if (caseInsertError || !newCase) throw new Error('kyc_fraud_case_save_failed');

      if (establishedOwner && establishedOwner.id !== merchantId && documentMatch) {
        const actor = await supabase.from('merchants').select('id, available_balance, available_balance_usd').eq('id', merchantId).single();
        if (actor.error || !actor.data) throw new Error('kyc_duplicate_account_lookup_failed');
        const hasFunds = Number(actor.data.available_balance || 0) > 0 || Number(actor.data.available_balance_usd || 0) > 0;
        const ownerAlert = await createNotification(establishedOwner.id, 'security_alert', 'Tentative d’utilisation de votre identité',
          'Une tentative de vérification avec votre pièce d’identité a été détectée sur un autre compte. Votre compte reste actif et n’a pas été suspendu par cette détection. Si vous ne reconnaissez pas cette activité, contactez le support Kobara. Ne partagez aucun code de sécurité.',
          establishedOwner.email, `identity-reuse:${establishedOwner.id}:${sessionId}`);
        if (ownerAlert && !ownerAlert.created && !ownerAlert.deduplicated) throw new Error('kyc_owner_alert_save_failed');
        const closed = await supabase.from('merchants').update({ status: 'suspended', kyc_status: 'suspended',
          account_access: hasFunds ? 'closure_pending_payout' : 'permanently_closed', updated_at: new Date().toISOString(),
        }).eq('id', merchantId);
        if (closed.error) throw new Error('kyc_duplicate_account_closure_failed');
        const profile = await supabase.from('kyc_profiles').update({ status: 'suspended',
          rejection_reason: 'Compte bloqué après contrôle d’identité. Contactez le support pour demander un examen.',
        }).eq('merchant_id', merchantId);
        if (profile.error) throw new Error('kyc_duplicate_profile_closure_failed');
        const saved = await supabase.from('kyc_fraud_cases').update({ status: 'confirmed_fraud', action_taken: 'closed_duplicate_account',
          primary_verdict: 'fraudulent', related_verdict: 'legitimate',
          evidence: { signals, document_fingerprint: currentDocFingerprint, identity_owner_merchant_id: establishedOwner.id },
          payout_status: hasFunds ? 'pending_instructions' : 'none',
        }).eq('id', newCase.id);
        if (saved.error) throw new Error('kyc_duplicate_case_closure_failed');
        await supabase.from('audit_logs').insert({ merchant_id: merchantId, action: 'kyc_duplicate_account_closed',
          entity_type: 'fraud_case', entity_id: newCase.id,
          metadata: { protected_owner_merchant_id: establishedOwner.id, session_id: sessionId, funds_preserved: hasFunds } });
        return { isFraud: true, severity: 'critical', score: riskScore, signals, primaryMerchantId: merchantId,
          relatedMerchantId: establishedOwner.id, protectedOwnerMerchantId: establishedOwner.id,
          documentMatch, faceMatch, deviceMatch, ipMatch, actionTaken: 'closed_duplicate_account', fraudCaseId: newCase.id };
      }

      if (newCase) {
        fraudCaseId = newCase.id;
        const relatedState = relatedMerchantId && relatedMerchantId !== merchantId
          ? await supabase.from('merchants').select('account_access').eq('id', relatedMerchantId).maybeSingle()
          : { data: null, error: null };
        if (relatedState.error) throw new Error('kyc_related_account_lookup_failed');
        const relatedAlreadyClosed = ['closure_pending', 'closure_pending_payout', 'closed', 'permanently_closed'].includes(relatedState.data?.account_access || '');

        // 2. Suspension transactionnelle et atomique des DEUX comptes (A et B)
        const suspension = await supabase.rpc('suspend_duplicate_identity_accounts', {
          p_merchant_id_a: merchantId,
          p_merchant_id_b: relatedAlreadyClosed ? merchantId : relatedMerchantId || merchantId,
          p_fraud_case_id: fraudCaseId,
          p_reason: `Fraude d'identité critique détectée: ${reasonDesc}`,
        });
        if (suspension.error) throw new Error('kyc_suspension_failed');

        actionTaken = relatedAlreadyClosed ? 'suspended_current_account' : 'suspended_both_accounts';
        if (relatedAlreadyClosed) await supabase.from('kyc_fraud_cases').update({ action_taken: actionTaken }).eq('id', fraudCaseId);

        // 3. Alerte d'urgence aux administrateurs
        try {
          await supabase.from('risk_alerts').insert({
            merchant_id: merchantId,
            alert_type: 'kyc_identity_fraud_critical',
            severity: 'critical',
            status: 'open',
            description: `ALERTE CRITIQUE KYC: Identité partagée entre ${merchantId} et ${relatedMerchantId || 'inconnu'}. Deux comptes suspendus.`,
          });
        } catch (e) {
          console.error('[KycFraudEngine] Admin alert error:', e);
        }

        // 4. Exécution de l'AI Compliance Analyst (Rapport interne Support/Compliance uniquement)
        try {
          const { AIComplianceAnalyst } = await import('@/lib/server/kyc/ai-compliance-analyst');
          const { data: pMerchant } = await supabase.from('merchants').select('id, business_name, email, account_access, kyc_status').eq('id', merchantId).single();
          let rMerchant = null;
          if (relatedMerchantId && relatedMerchantId !== merchantId) {
            const { data: rm } = await supabase.from('merchants').select('id, business_name, email, account_access, kyc_status').eq('id', relatedMerchantId).maybeSingle();
            rMerchant = rm;
          }

          await AIComplianceAnalyst.analyzeAndReport({
            fraud_case_id: newCase.id,
            severity: 'critical',
            action_taken: 'suspended_both_accounts',
            primary_merchant: pMerchant || { id: merchantId, business_name: 'Inconnu', email: '', account_access: 'suspended', kyc_status: 'suspended' },
            related_merchant: rMerchant,
            didit: {
              current_session_id: sessionId,
              related_session_id: relatedSessionId,
              status: decision?.status,
            },
            evidence: {
              exact_document_match: documentMatch,
              confirmed_face_match: faceMatch,
              possible_face_match: signals.some(s => s.code.includes('POSSIBLE')),
              duplicate_user: signals.some(s => s.code.includes('DUPLICATE_USER')),
              duplicate_device: deviceMatch,
              duplicate_ip: ipMatch,
            },
            warnings: signals.map(s => s.code),
            timeline: [
              { step: 'Session Didit créée', timestamp: new Date().toISOString() },
              { step: 'Webhook Didit reçu et vérifié', timestamp: new Date().toISOString() },
              { step: 'KycFraudEngine : Fraude critique détectée', timestamp: new Date().toISOString() },
              { step: 'RPC suspend_duplicate_identity_accounts exécutée', timestamp: new Date().toISOString() },
            ],
            suspension_reason: `Fraude d'identité critique détectée: ${reasonDesc}`,
            created_at: new Date().toISOString(),
          });
        } catch (aiErr) {
          console.error('[KycFraudEngine] Échec de l\'AI Compliance Analyst (la suspension reste valide):', aiErr);
        }
      }
    } else if (overallSeverity === 'high' || overallSeverity === 'medium') {
      // Niveau High / Medium : Créer le dossier et mettre en revue manuelle
      const { data: newCase } = await supabase
        .from('kyc_fraud_cases')
        .insert({
          case_type: deviceMatch ? 'duplicate_device' : 'multi_signal',
          severity: overallSeverity,
          status: 'under_review',
          primary_merchant_id: merchantId,
          related_merchant_id: relatedMerchantId,
          primary_session_id: sessionId,
          related_session_id: relatedSessionId,
          document_match: documentMatch,
          face_match: faceMatch,
          device_match: deviceMatch,
          ip_match: ipMatch,
          risk_score: riskScore,
          reason_codes: signals.map(s => s.code),
          evidence: { signals, document_fingerprint: currentDocFingerprint },
          action_taken: overallSeverity === 'high' ? 'restricted' : 'placed_in_review',
        })
        .select('id')
        .single();

      fraudCaseId = newCase?.id;

      // Mettre le profil KYC sous revue
      await supabase.from('kyc_profiles').update({
        status: 'in_review',
        risk_score: riskScore,
        rejection_reason: 'Dossier transmis à l’équipe conformité pour vérification de sécurité.',
        updated_at: new Date().toISOString(),
      }).eq('merchant_id', merchantId);

      await supabase.from('merchants').update({
        kyc_status: 'in_review',
        ...(overallSeverity === 'high' ? { account_access: 'restricted' } : {}),
        updated_at: new Date().toISOString(),
      }).eq('id', merchantId);

      actionTaken = overallSeverity === 'high' ? 'restricted' : 'placed_in_review';
    } else if (signals.length > 0) {
      // Niveau LOW (ex: IP partagée seule) : simple log d'audit, aucune restriction
      await supabase.from('risk_events').insert({
        merchant_id: merchantId,
        event_type: 'kyc_low_risk_signal',
        description: `Signal KYC faible: ${signals.map(s => s.code).join(', ')}`,
        risk_points: riskScore,
        metadata: { signals },
      });
      actionTaken = 'logged';
    }

    return {
      isFraud,
      severity: overallSeverity,
      score: riskScore,
      signals,
      primaryMerchantId: merchantId,
      relatedMerchantId,
      documentMatch,
      faceMatch,
      deviceMatch,
      ipMatch,
      actionTaken,
      fraudCaseId,
      rejectionReason: isFraud ? "Informations d'identité associées à un autre compte." : undefined,
    };
  }

  /**
   * Résolution d'un cas de fraude KYC par l'équipe Compliance selon les normes GAFI / BRH.
   * - Ne supprime jamais physiquement de données (NO HARD DELETE).
   * - Compte légitime : passe en reverify_required et révoque ses sessions. Seul un nouveau Didit KYC valide le repassera active.
   * - Compte dupliqué : passe en closure_pending ou closure_pending_payout avec un délai de 190 jours si solde > 0.
   */
  static async resolveFraudCase(input: {
    fraudCaseId: string;
    adminUserId: string;
    primaryVerdict: 'legitimate' | 'fraudulent';
    relatedVerdict: 'confirmed_duplicate' | 'legitimate' | 'fraudulent';
    note: string;
  }) {
    const supabase = createAdminClient();
    const { fraudCaseId, adminUserId, primaryVerdict, relatedVerdict, note } = input;

    // 1. Récupérer le dossier de fraude et les marchands concernés
    const { data: fraudCase, error: caseErr } = await supabase
      .from('kyc_fraud_cases')
      .select('*')
      .eq('id', fraudCaseId)
      .single();

    if (caseErr || !fraudCase) {
      throw new Error(`Cas de fraude #${fraudCaseId} introuvable.`);
    }
    if (!['legitimate', 'fraudulent'].includes(primaryVerdict)
      || !['legitimate', 'fraudulent', 'confirmed_duplicate'].includes(relatedVerdict)) throw new Error('invalid_fraud_verdict');

    const primaryId = fraudCase.primary_merchant_id;
    const relatedId = fraudCase.related_merchant_id;

    const { data: pMerchant, error: primaryError } = await supabase
      .from('merchants')
      .select('id, business_name, email, available_balance, available_balance_usd, account_access, kyc_status')
      .eq('id', primaryId)
      .single();
    if (primaryError || !pMerchant) throw new Error('kyc_primary_merchant_not_found');

    let rMerchant = null;
    if (relatedId && relatedId !== primaryId) {
      const { data: rm, error: relatedError } = await supabase
        .from('merchants')
        .select('id, business_name, email, available_balance, available_balance_usd, account_access, kyc_status')
        .eq('id', relatedId)
        .maybeSingle();
      if (relatedError || !rm) throw new Error('kyc_related_merchant_not_found');
      rMerchant = rm;
    }

    const now = new Date();
    const deadline190d = new Date(now.getTime() + 190 * 24 * 60 * 60 * 1000).toISOString();
    const ids = [primaryId, ...(rMerchant ? [rMerchant.id] : [])];
    const fingerprints = await supabase.from('kyc_identity_fingerprints')
      .select('merchant_id, document_fingerprint').in('merchant_id', ids);
    const oldProfiles = await supabase.from('kyc_profiles')
      .select('id, merchant_id, gemini_review, metadata, document_front_url, document_back_url, selfie_url').in('merchant_id', ids);
    if (fingerprints.error || oldProfiles.error) throw new Error('kyc_resolution_archive_failed');
    const allFingerprints = [...new Set((fingerprints.data || []).map((row: any) => row.document_fingerprint))];
    const caseFingerprint = fraudCase.evidence?.document_fingerprint;
    const resolvedIdentity = {
      fingerprints: typeof caseFingerprint === 'string' ? [caseFingerprint]
        : fraudCase.document_match && allFingerprints.length === 1 ? allFingerprints : [],
      session_ids: [...new Set([fraudCase.primary_session_id, fraudCase.related_session_id,
        ...(oldProfiles.data || []).map((row: any) => row.gemini_review?.didit_session_id || row.metadata?.didit_session_id)].filter(Boolean))],
      isolated_profiles: oldProfiles.data || [],
      isolated_at: now.toISOString(),
    };
    const write = async (query: PromiseLike<{ error: unknown }>) => {
      const result = await query;
      if (result.error) throw new Error('kyc_resolution_write_failed');
    };

    // --- 2. Traitement du Compte Principal (A) ---
    if (primaryVerdict === 'legitimate') {
      // A est le propriétaire légitime -> Passage en re-vérification obligatoire
      await write(supabase.from('merchants').update({
        status: 'active',
        account_access: 'reverify_required',
        kyc_status: 'pending_reverification',
        updated_at: now.toISOString(),
      }).eq('id', primaryId));

      // Révoquer le profil KYC actuel de A pour forcer une nouvelle session Didit propre
      await write(supabase.from('kyc_profiles').update({
        status: 'pending',
        rejection_reason: 'Dossier débloqué par la conformité. Veuillez procéder à une nouvelle vérification d’identité Didit.',
        updated_at: now.toISOString(),
      }).eq('merchant_id', primaryId));

    } else {
      // A est dupliqué/frauduleux -> Clôture
      const pBalance = Number(pMerchant?.available_balance || 0);
      const pAccess = pBalance > 0 || Number(pMerchant?.available_balance_usd || 0) > 0 ? 'closure_pending_payout' : 'permanently_closed';

      await write(supabase.from('merchants').update({
        status: 'suspended',
        account_access: pAccess,
        kyc_status: 'suspended',
        updated_at: now.toISOString(),
      }).eq('id', primaryId));
    }

    // --- 3. Traitement du Compte Lié (B) ---
    let bPayoutStatus = 'none';
    if (rMerchant) {
      if (relatedVerdict === 'legitimate') {
        // B est le propriétaire légitime -> Passage en re-vérification obligatoire
        await write(supabase.from('merchants').update({
          status: 'active',
          account_access: 'reverify_required',
          kyc_status: 'pending_reverification',
          updated_at: now.toISOString(),
        }).eq('id', rMerchant.id));

        await write(supabase.from('kyc_profiles').update({
          status: 'pending',
          rejection_reason: 'Dossier débloqué par la conformité. Veuillez procéder à une nouvelle vérification d’identité Didit.',
          updated_at: now.toISOString(),
        }).eq('merchant_id', rMerchant.id));

      } else {
        // B est dupliqué -> Clôture et restitution si solde > 0
        const rBalance = Number(rMerchant.available_balance || 0);
        const hasRelatedFunds = rBalance > 0 || Number(rMerchant.available_balance_usd || 0) > 0;
        const rAccess = hasRelatedFunds ? 'closure_pending_payout' : 'permanently_closed';
        bPayoutStatus = hasRelatedFunds ? 'pending_instructions' : 'none';

        await write(supabase.from('merchants').update({
          status: 'suspended',
          account_access: rAccess,
          kyc_status: 'suspended',
          updated_at: now.toISOString(),
        }).eq('id', rMerchant.id));
      }
    }

    // --- 4. Mise à jour de la fiche d'audit du dossier de fraude ---
    const isBothFraud = primaryVerdict === 'fraudulent' && relatedVerdict === 'fraudulent';
    const isFalsePositive = primaryVerdict === 'legitimate' && relatedVerdict === 'legitimate';
    const caseStatus = isFalsePositive ? 'false_positive' : isBothFraud ? 'confirmed_fraud' : 'resolved';

    await write(supabase.from('kyc_fraud_cases').update({
      status: caseStatus,
      primary_verdict: primaryVerdict,
      related_verdict: relatedVerdict,
      resolution_note: note,
      resolved_by: adminUserId,
      resolved_at: now.toISOString(),
      evidence: { ...(fraudCase.evidence || {}), resolved_identity: resolvedIdentity },
      payout_status: bPayoutStatus,
      payout_amount: rMerchant ? Number(rMerchant.available_balance || 0) : 0,
      payout_deadline_at: bPayoutStatus !== 'none' ? deadline190d : null,
      updated_at: now.toISOString(),
    }).eq('id', fraudCaseId));

    await write(supabase.from('kyc_identity_fingerprints').update({ status: 'archived', updated_at: now.toISOString() }).in('merchant_id', ids));
    for (const old of oldProfiles.data || []) {
      const legitimate = old.merchant_id === primaryId ? primaryVerdict === 'legitimate' : relatedVerdict === 'legitimate';
      await write(supabase.from('kyc_profiles').update({
        status: legitimate ? 'pending' : 'suspended', gemini_review: {},
        metadata: { ...(old.metadata || {}), didit_session_id: null },
        document_front_url: null, document_back_url: null, selfie_url: null,
        updated_at: now.toISOString(),
      }).eq('id', old.id));
    }
    const oldSignals = Array.isArray(fraudCase.evidence?.signals) ? fraudCase.evidence.signals : [];
    const oldReason = `Fraude d'identité critique détectée: ${oldSignals.map((signal: any) => signal.description).join(' | ')}`;
    for (const id of ids.filter(id => id === primaryId ? primaryVerdict === 'legitimate' : relatedVerdict === 'legitimate')) {
      await write(supabase.from('merchant_restrictions').update({
        lifted_by: adminUserId, lifted_at: now.toISOString(), lift_reason: note,
      }).eq('merchant_id', id).eq('restriction_type', 'duplicate_identity_suspension')
        .eq('reason', oldReason).is('lifted_at', null)
        .lte('created_at', fraudCase.updated_at || fraudCase.created_at));
    }

    // Audit Log de la décision administrative
    await supabase.from('audit_logs').insert({
      merchant_id: primaryId,
      action: 'kyc_fraud_case_resolved_aml',
      metadata: {
        fraud_case_id: fraudCaseId,
        admin_user_id: adminUserId,
        primary_verdict: primaryVerdict,
        related_verdict: relatedVerdict,
        payout_deadline: deadline190d,
        note,
      },
    });

    // --- 5. Notification et rapport AI Compliance Analyst pour le support interne ---
    try {
      const { AIComplianceAnalyst } = await import('@/lib/server/kyc/ai-compliance-analyst');
      await AIComplianceAnalyst.analyzeAndReport({
        fraud_case_id: fraudCaseId,
        severity: fraudCase.severity,
        action_taken: 'resolved_aml_compliance',
        primary_merchant: pMerchant || { id: primaryId, business_name: 'Compte A', email: '', account_access: 'reverify_required', kyc_status: 'pending_reverification' },
        related_merchant: rMerchant,
        didit: { current_session_id: fraudCase.primary_session_id, status: 'Resolved' },
        evidence: fraudCase.evidence || {},
        warnings: fraudCase.reason_codes || [],
        timeline: [
          { step: 'Fraude KYC détectée', timestamp: fraudCase.created_at },
          { step: `Résolution Admin Compliance par ${adminUserId}`, timestamp: now.toISOString() },
          { step: `Compte A : ${primaryVerdict}`, timestamp: now.toISOString() },
          { step: `Compte B : ${relatedVerdict}`, timestamp: now.toISOString() },
        ],
        suspension_reason: note,
        created_at: now.toISOString(),
      });
    } catch (aiErr) {
      console.error('[KycFraudEngine] Rapport AI Post-Résolution échoué (la décision reste valide):', aiErr);
    }

    return {
      success: true,
      caseStatus,
      primaryId,
      relatedId,
      primaryVerdict,
      relatedVerdict,
      payoutDeadline: deadline190d,
    };
  }

  /**
   * Soumission par le compte dupliqué des coordonnées de versement pour restitution sous 190 jours.
   */
  static async submitClosurePayoutInstructions(input: {
    merchantId: string;
    payoutMethod: 'moncash' | 'natcash' | 'bank';
    payoutAccountNumber: string;
    payoutAccountName: string;
    documentProofUrl?: string;
  }) {
    const supabase = createAdminClient();
    const { merchantId, payoutMethod, payoutAccountNumber, payoutAccountName, documentProofUrl } = input;

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, available_balance, account_access')
      .eq('id', merchantId)
      .single();

    if (!merchant) throw new Error("Compte introuvable.");

    const balance = Number(merchant.available_balance || 0);
    if (balance <= 0) throw new Error("Aucun solde restant à verser.");

    // Retrouver le dossier de fraude lié
    const { data: fraudCase } = await supabase
      .from('kyc_fraud_cases')
      .select('id')
      .or(`primary_merchant_id.eq.${merchantId},related_merchant_id.eq.${merchantId}`)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (!fraudCase) throw new Error("Aucune procédure de clôture financière active.");

    const { data: req, error } = await supabase
      .from('merchant_closure_payout_requests')
      .insert({
        fraud_case_id: fraudCase.id,
        merchant_id: merchantId,
        amount: balance,
        payout_method: payoutMethod,
        payout_account_number: payoutAccountNumber,
        payout_account_name: payoutAccountName,
        document_proof_url: documentProofUrl || null,
        status: 'submitted',
      })
      .select('id')
      .single();

    if (error) throw new Error("Erreur de sauvegarde des instructions: " + error.message);

    // Mettre à jour le statut du payout dans le dossier de fraude
    await supabase.from('kyc_fraud_cases').update({
      payout_status: 'instructions_submitted',
      payout_details: {
        payoutMethod,
        payoutAccountNumber,
        payoutAccountName,
        documentProofUrl,
        submitted_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', fraudCase.id);

    return { success: true, requestId: req.id };
  }

  /**
   * Validation & Exécution du versement de restitution des fonds par l'administrateur.
   */
  static async processClosurePayout(input: {
    fraudCaseId: string;
    adminUserId: string;
    transactionReference: string;
    note?: string;
  }) {
    const supabase = createAdminClient();
    const { fraudCaseId, adminUserId, transactionReference, note } = input;

    const { data: fraudCase } = await supabase
      .from('kyc_fraud_cases')
      .select('*')
      .eq('id', fraudCaseId)
      .single();

    if (!fraudCase) throw new Error("Dossier de fraude introuvable.");

    // Trouver le compte dupliqué à fermer (celui qui avait du solde)
    const targetMerchantId = fraudCase.related_merchant_id || fraudCase.primary_merchant_id;

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, available_balance')
      .eq('id', targetMerchantId)
      .single();

    if (!merchant) throw new Error("Marchand introuvable.");

    const amount = Number(merchant.available_balance || 0);

    // 1. Remettre le solde à zéro
    await supabase.from('merchants').update({
      available_balance: 0,
      account_access: 'closed',
      updated_at: new Date().toISOString(),
    }).eq('id', targetMerchantId);

    // 2. Marquer le dossier de fraude comme settled
    await supabase.from('kyc_fraud_cases').update({
      payout_status: 'settled',
      settled_at: new Date().toISOString(),
      resolution_note: `${fraudCase.resolution_note || ''} | Payout réglé (${transactionReference}): ${note || ''}`,
      updated_at: new Date().toISOString(),
    }).eq('id', fraudCaseId);

    // 3. Valider la demande de versement
    await supabase
      .from('merchant_closure_payout_requests')
      .update({
        status: 'paid',
        admin_note: `Règlement effectué par ${adminUserId}. Réf: ${transactionReference}`,
        updated_at: new Date().toISOString(),
      })
      .eq('fraud_case_id', fraudCaseId);

    // 4. Audit Log
    await supabase.from('audit_logs').insert({
      merchant_id: targetMerchantId,
      action: 'kyc_closure_payout_settled',
      metadata: {
        fraud_case_id: fraudCaseId,
        admin_user_id: adminUserId,
        amount,
        transaction_reference: transactionReference,
      },
    });

    return { success: true, settledAmount: amount };
  }
}

