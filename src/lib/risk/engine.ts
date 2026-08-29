import { supabaseAdmin } from "@/lib/supabase/admin"
import { RuleViolation } from "@/types/risk"
import { cguRuleExecutor } from "./cgu-rule-executor"
import { riskNotifier } from "../notifications/risk-notifier"

export const riskEngine = {
  async runSystemRules(merchantId: string) {
    // Implémentation des 10 règles système codées en dur
    // login abuse, payment abuse, API abuse, webhook failure, volume spike, 
    // structuring AML, suspicious withdrawal, IP/device anomaly, KYC failure patterns, multi-account
    const violations: RuleViolation[] = []
    
    // Simulation pour le scaffold
    return violations
  },

  async analyzeMerchant(merchantId: string) {
    console.log(`Starting risk analysis for merchant ${merchantId}`)
    
    // VÉRIFICATION D'ENVIRONNEMENT : Ne pas pénaliser les environnements de test
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("current_environment")
      .eq("id", merchantId)
      .single()

    if (merchant?.current_environment === "test") {
      console.log(`[RISK ENGINE] Skipped ${merchantId}: merchant is in test environment.`)
      return { score: 0, riskLevel: 'low', violations: [] }
    }
    // 1. Exécuter les règles système
    const systemResults = await this.runSystemRules(merchantId)

    // 2. Exécuter les règles dynamiques IA
    const cguResults = await cguRuleExecutor.run(merchantId)

    // 3. Fusionner et dédupliquer (simplifié ici)
    const allViolations = [...systemResults, ...cguResults]

    if (allViolations.length === 0) {
      return { score: 0, riskLevel: 'low', violations: [] }
    }

    let totalPoints = 0
    for (const v of allViolations) {
      totalPoints += v.riskPoints

      // Enregistrer la violation
      if (v.ruleId) {
        await supabaseAdmin.from("rule_violation_logs").insert({
          merchant_id: merchantId,
          rule_id: v.ruleId,
          rule_name: v.ruleName,
          legal_basis: v.legalBasis,
          evidence: v.evidence,
          risk_points: v.riskPoints,
          action_taken: v.riskPoints > 30 ? "immediate_flag" : "logged"
        })
      }
    }

    // Récupérer le score actuel
    const { data: currentScoreData } = await supabaseAdmin
      .from("merchant_risk_scores")
      .select("score")
      .eq("merchant_id", merchantId)
      .single()

    const currentScore = currentScoreData?.score || 0
    const newScore = Math.min(currentScore + totalPoints, 100)
    
    let riskLevel = "low"
    if (newScore >= Number(process.env.RISK_THRESHOLD_SUSPENDED || 95)) riskLevel = "suspended"
    else if (newScore >= Number(process.env.RISK_THRESHOLD_CRITICAL || 80)) riskLevel = "critical"
    else if (newScore >= Number(process.env.RISK_THRESHOLD_HIGH || 60)) riskLevel = "high"
    else if (newScore >= Number(process.env.RISK_THRESHOLD_MEDIUM || 40)) riskLevel = "medium"

    // Mettre à jour le score
    await supabaseAdmin
      .from("merchant_risk_scores")
      .upsert({ 
        merchant_id: merchantId, 
        score: newScore, 
        risk_level: riskLevel,
        last_updated_at: new Date().toISOString()
      })

    // Action immédiate (comme demandé)
    if (riskLevel === "suspended" || riskLevel === "critical") {
      await this.applyRestriction(merchantId, riskLevel, allViolations)
    }

    // Notifications
    if (riskLevel === "high" || riskLevel === "critical" || riskLevel === "suspended") {
      await riskNotifier.sendHighRiskAlert(merchantId, newScore, allViolations)
    }

    return { score: newScore, riskLevel, violations: allViolations }
  },

  async applyRestriction(merchantId: string, level: string, violations: any[]) {
    const reason = `Automated ${level} restriction. Violated rules: ${violations.map(v => v.ruleName).join(', ')}`
    
    await supabaseAdmin.from("merchant_restrictions").insert({
      merchant_id: merchantId,
      restriction_type: level === "suspended" ? "full_suspension" : "payout_freeze",
      reason: reason
    })

    await supabaseAdmin.from("risk_alerts").insert({
      merchant_id: merchantId,
      alert_type: "auto_restriction",
      severity: level === "suspended" ? "critical" : "high",
      status: "open",
      description: reason
    })

    console.warn(`[ACTION IMMÉDIATE] Le marchand ${merchantId} a été restreint (${level}).`)
  }
}
