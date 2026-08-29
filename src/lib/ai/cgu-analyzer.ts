import { generateText } from 'ai'
import { google } from '@ai-sdk/google'
import { z } from 'zod'
import { CGUAnalysisRule } from '@/types/risk'

// ... Keep existing schema definitions but change the implementation ...

export async function analyzeCGU(documentText: string, version: string): Promise<CGUAnalysisRule[]> {
  const prompt = `
Tu es un expert en conformité réglementaire fintech spécialisé dans les marchés haïtiens et les systèmes de paiement mobile (MonCash).

Tu dois analyser les Conditions Générales d'Utilisation d'une passerelle de paiement et générer des règles de détection automatique pour un système de monitoring de risque.

CGU À ANALYSER :
${documentText}

VERSION : ${version}

TÂCHE :
Identifie toutes les situations qui doivent déclencher une alerte de risque selon ces CGU. Pour chaque situation identifiée, génère une règle de détection.

Catégories à couvrir obligatoirement :
1. Activités explicitement interdites (§ interdictions)
2. Comportements frauduleux (fausse KYC, multi-comptes, etc.)
3. Violations des limites de retrait ou de transaction
4. Usage abusif de l'API ou des webhooks
5. Comportements AML/CFT suspects
6. Violations des conditions de compte marchand

RÈGLES DE GÉNÉRATION :
- Génère UNIQUEMENT des règles détectables techniquement avec les données disponibles
- risk_points doit être proportionnel à la gravité (5=mineur, 50=critique AML)
- Pour les activités AML : severity=critical, auto_action=freeze obligatoirement
- Ne pas dupliquer les règles (une règle par comportement distinct)
- legal_basis doit citer le texte exact ou l'article de référence
- Si une interdiction est vague et non détectable techniquement, l'ignorer

IMPORTANT : Tu dois retourner STRICTEMENT ET UNIQUEMENT un objet JSON valide contenant un tableau "rules".
Ce tableau doit contenir des objets avec EXACTEMENT cette structure:
{
  "rule_name": string,
  "rule_category": "prohibited_activity" | "aml" | "api_abuse" | "kyc_fraud" | "withdrawal_abuse" | "account_abuse",
  "description": string,
  "legal_basis": string,
  "severity": "low" | "medium" | "high" | "critical",
  "risk_points": number (5 to 50),
  "auto_action": "warn" | "restrict" | "freeze" | "flag_review" | "none",
  "detection_logic": {
    "type": "transaction_pattern" | "behavior_pattern" | "amount_threshold" | "keyword_match",
    "description": string,
    "data_sources": string[],
    "time_window_minutes": number,
    "threshold": number,
    "conditions": string[],
    "redis_key_pattern": string
  }
}
Ne retourne aucun texte d'introduction, aucune balise markdown. Uniquement le JSON brut.
  `

  try {
    const { text } = await generateText({
      model: google(process.env.CGU_ANALYSIS_MODEL || 'gemini-2.5-pro'),
      prompt: prompt,
    })

    // Clean markdown blocks if Gemini still added them
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const parsed = JSON.parse(cleanJson)
    
    // Quick validation
    if (!parsed.rules || !Array.isArray(parsed.rules)) {
      throw new Error("Invalid JSON structure: missing rules array")
    }

    return parsed.rules as CGUAnalysisRule[]
  } catch (error) {
    console.error("Error analyzing CGU with Gemini:", error)
    throw new Error("Échec de l'analyse IA des CGU")
  }
}
