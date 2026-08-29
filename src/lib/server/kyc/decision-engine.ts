export interface KycSignals {
  email_verified: boolean;
  phone_verified: boolean;
  document_type: string;
  document_required_sides_present: boolean;
  document_quality_score: number;
  document_expired: boolean;
  ocr_score: number;
  name_match_score: number;
  selfie_present: boolean;
  face_detected: boolean;
  face_match_score: number;
  liveness_score: number;
  duplicate_document: boolean;
  duplicate_phone: boolean;
  duplicate_selfie: boolean;
  risk_score: number;
  gemini_review: {
    risk_level?: string;
    recommended_status?: string;
    observations?: string[];
    inconsistencies?: string[];
    admin_summary?: string;
  };
}

export interface KycDecision {
  status: 'approved' | 'in_review' | 'rejected';
  score: number;
  reasons: string[];
}

/**
 * Moteur de décision KYC Kobara :
 * Règle stricte : Ne JAMAIS rejeter automatiquement un dossier.
 * Si l'IA ou les signaux ne permettent pas une validation automatique immédiate à 100%,
 * le dossier bascule automatiquement en revue manuelle ('in_review') pour l'équipe admin.
 */
export function decideKycStatus(signals: KycSignals): KycDecision {
  const reasons: string[] = [];
  let score = 0;
  let requiresManualReview = false;

  // 1. Contrôles critiques (Passage immédiat en revue manuelle si anomalie)
  if (!signals.email_verified) {
    requiresManualReview = true;
    reasons.push("Email non vérifié");
  }
  if (!signals.phone_verified) {
    requiresManualReview = true;
    reasons.push("Téléphone non vérifié");
  }
  if (!signals.document_required_sides_present) {
    requiresManualReview = true;
    reasons.push("Document incomplet (faces manquantes)");
  }
  if (!signals.selfie_present) {
    requiresManualReview = true;
    reasons.push("Selfie manquant");
  }
  if (signals.document_expired) {
    requiresManualReview = true;
    reasons.push("Document potentiellement expiré");
  }
  if (signals.duplicate_document) {
    requiresManualReview = true;
    reasons.push("Document déjà utilisé par un autre compte");
  }
  if (signals.liveness_score < 50) {
    requiresManualReview = true;
    reasons.push("Score de preuve de vie insuffisant");
  }
  if (signals.face_match_score < 50) {
    requiresManualReview = true;
    reasons.push("Correspondance faciale incertaine entre le document et le selfie");
  }

  // 2. Calcul du Score de confiance
  if (signals.email_verified) score += 10;
  if (signals.phone_verified) score += 10;
  if (signals.document_required_sides_present) score += 10;
  if (signals.document_quality_score >= 80) score += 15;
  if (signals.ocr_score >= 80) score += 10;
  if (signals.name_match_score >= 80) score += 10;
  if (signals.face_match_score >= 80) score += 20;
  if (signals.liveness_score >= 80) score += 20;
  if (!signals.duplicate_document) score += 5;

  // 3. Évaluation de la qualité & analyse IA Gemini
  if (signals.document_quality_score < 70) {
    requiresManualReview = true;
    reasons.push("Qualité du document insuffisante");
  }
  if (signals.ocr_score < 70) {
    requiresManualReview = true;
    reasons.push("Lecture du texte OCR difficile");
  }
  if (signals.name_match_score < 70) {
    requiresManualReview = true;
    reasons.push("Correspondance du nom incertaine");
  }
  if (signals.liveness_score >= 50 && signals.liveness_score < 80) {
    requiresManualReview = true;
    reasons.push("Preuve de vie douteuse");
  }
  if (signals.face_match_score >= 50 && signals.face_match_score < 80) {
    requiresManualReview = true;
    reasons.push("Correspondance faciale incertaine");
  }
  if (signals.risk_score >= 60) {
    requiresManualReview = true;
    reasons.push("Score de risque élevé");
  }
  
  if (signals.gemini_review) {
    if (signals.gemini_review.recommended_status === 'rejected') {
      requiresManualReview = true;
      reasons.push("L'analyse IA signale des documents douteux ou non conformes (Examen admin requis)");
    } else if (signals.gemini_review.recommended_status === 'in_review') {
      requiresManualReview = true;
      reasons.push("Vérification manuelle demandée par l'analyse IA");
    }
    if (signals.gemini_review.risk_level === 'high' || signals.gemini_review.risk_level === 'critical') {
      requiresManualReview = true;
      reasons.push(`Risque ${signals.gemini_review.risk_level} signalé lors de l'analyse automatique`);
    }
  }

  // 4. Décision finale :
  // Si le score est excellent (>= 85) et aucune anomalie bloquante -> APPROBATION AUTOMATIQUE
  if (!requiresManualReview && score >= 85) {
    return {
      status: 'approved',
      score,
      reasons: ["Toutes les vérifications sont validées avec succès par l'IA."]
    };
  }

  // Dans TOUS les autres cas (doute, erreur IA, document incomplet, etc.), bascule automatique en REVUE MANUELLE
  return {
    status: 'in_review',
    score: Math.max(score, 0),
    reasons: reasons.length > 0 ? reasons : ["Examen manuel requis par l'équipe de conformité."]
  };
}
