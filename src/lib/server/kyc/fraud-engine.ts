import 'server-only';

import crypto from 'crypto';
import { createAdminClient } from '@/utils/supabase/admin';
import { notifyAdminWithdrawalCreated } from '@/lib/server/notifications';

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
  actionTaken: 'none' | 'logged' | 'placed_in_review' | 'restricted' | 'suspended_both_accounts';
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

    const signals: KycFraudSignal[] = [];
    let riskScore = 0;
    let documentMatch = false;
    let faceMatch = false;
    let deviceMatch = false;
    let ipMatch = false;
    let relatedMerchantId: string | null = null;
    let relatedSessionId: string | null = null;

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
      const { data: existingFingerprint } = await supabase
        .from('kyc_identity_fingerprints')
        .select('merchant_id, status')
        .eq('document_fingerprint', currentDocFingerprint)
        .neq('merchant_id', merchantId)
        .maybeSingle();

      if (existingFingerprint) {
        documentMatch = true;
        relatedMerchantId = existingFingerprint.merchant_id;
        signals.push({
          source: 'identity',
          code: 'SAME_DOCUMENT_EXACT_MATCH',
          severity: 'critical',
          description: `Même pièce d'identité utilisée sur un autre compte marchand (${existingFingerprint.merchant_id}).`,
          relatedMerchantId: existingFingerprint.merchant_id,
        });
        riskScore += 100;
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
        if (relSession) relatedSessionId = relSession;

        if (isConfirmed) {
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

      const { data: newCase } = await supabase
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
          evidence: { signals, decision_summary: decision?.status },
          action_taken: 'pending_suspension',
        })
        .select('id')
        .single();

      if (newCase) {
        fraudCaseId = newCase.id;

        // 2. Suspension transactionnelle et atomique des DEUX comptes (A et B)
        await supabase.rpc('suspend_duplicate_identity_accounts', {
          p_merchant_id_a: merchantId,
          p_merchant_id_b: relatedMerchantId || merchantId,
          p_fraud_case_id: fraudCaseId,
          p_reason: `Fraude d'identité critique détectée: ${reasonDesc}`,
        });

        actionTaken = 'suspended_both_accounts';

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
          evidence: { signals },
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

    const primaryId = fraudCase.primary_merchant_id;
    const relatedId = fraudCase.related_merchant_id;

    const { data: pMerchant } = await supabase
      .from('merchants')
      .select('id, business_name, email, available_balance, account_access, kyc_status')
      .eq('id', primaryId)
      .single();

    let rMerchant = null;
    if (relatedId && relatedId !== primaryId) {
      const { data: rm } = await supabase
        .from('merchants')
        .select('id, business_name, email, available_balance, account_access, kyc_status')
        .eq('id', relatedId)
        .maybeSingle();
      rMerchant = rm;
    }

    const now = new Date();
    const deadline190d = new Date(now.getTime() + 190 * 24 * 60 * 60 * 1000).toISOString();

    // --- 2. Traitement du Compte Principal (A) ---
    if (primaryVerdict === 'legitimate') {
      // A est le propriétaire légitime -> Passage en re-vérification obligatoire
      await supabase.from('merchants').update({
        account_access: 'reverify_required',
        kyc_status: 'pending_reverification',
        updated_at: now.toISOString(),
      }).eq('id', primaryId);

      // Révoquer le profil KYC actuel de A pour forcer une nouvelle session Didit propre
      await supabase.from('kyc_profiles').update({
        status: 'pending',
        rejection_reason: 'Dossier débloqué par la conformité. Veuillez procéder à une nouvelle vérification d’identité Didit.',
        updated_at: now.toISOString(),
      }).eq('merchant_id', primaryId);

    } else {
      // A est dupliqué/frauduleux -> Clôture
      const pBalance = Number(pMerchant?.available_balance || 0);
      const pAccess = pBalance > 0 ? 'closure_pending_payout' : 'closure_pending';

      await supabase.from('merchants').update({
        account_access: pAccess,
        kyc_status: 'suspended',
        updated_at: now.toISOString(),
      }).eq('id', primaryId);
    }

    // --- 3. Traitement du Compte Lié (B) ---
    let bPayoutStatus = 'none';
    if (rMerchant) {
      if (relatedVerdict === 'legitimate') {
        // B est le propriétaire légitime -> Passage en re-vérification obligatoire
        await supabase.from('merchants').update({
          account_access: 'reverify_required',
          kyc_status: 'pending_reverification',
          updated_at: now.toISOString(),
        }).eq('id', rMerchant.id);

        await supabase.from('kyc_profiles').update({
          status: 'pending',
          rejection_reason: 'Dossier débloqué par la conformité. Veuillez procéder à une nouvelle vérification d’identité Didit.',
          updated_at: now.toISOString(),
        }).eq('merchant_id', rMerchant.id);

      } else {
        // B est dupliqué -> Clôture et restitution si solde > 0
        const rBalance = Number(rMerchant.available_balance || 0);
        const rAccess = rBalance > 0 ? 'closure_pending_payout' : 'closure_pending';
        bPayoutStatus = rBalance > 0 ? 'pending_instructions' : 'none';

        await supabase.from('merchants').update({
          account_access: rAccess,
          kyc_status: 'suspended',
          updated_at: now.toISOString(),
        }).eq('id', rMerchant.id);
      }
    }

    // --- 4. Mise à jour de la fiche d'audit du dossier de fraude ---
    const isBothFraud = primaryVerdict === 'fraudulent' && relatedVerdict === 'fraudulent';
    const isFalsePositive = primaryVerdict === 'legitimate' && relatedVerdict === 'legitimate';
    const caseStatus = isFalsePositive ? 'false_positive' : isBothFraud ? 'confirmed_fraud' : 'resolved';

    await supabase.from('kyc_fraud_cases').update({
      status: caseStatus,
      primary_verdict: primaryVerdict,
      related_verdict: relatedVerdict,
      resolution_note: note,
      resolved_by: adminUserId,
      resolved_at: now.toISOString(),
      payout_status: bPayoutStatus,
      payout_amount: rMerchant ? Number(rMerchant.available_balance || 0) : 0,
      payout_deadline_at: bPayoutStatus !== 'none' ? deadline190d : null,
      updated_at: now.toISOString(),
    }).eq('id', fraudCaseId);

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

