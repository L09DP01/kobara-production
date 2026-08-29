import { supabaseAdmin } from "@/lib/supabase/admin"
import { riskRedis } from "@/lib/redis/risk-counters"
import { RuleViolation, CGUAnalysisRule } from "@/types/risk"

export const cguRuleExecutor = {
  async loadActiveRules(): Promise<CGUAnalysisRule[]> {
    const cached = await riskRedis.getCachedActiveRules()
    if (cached) {
      return (typeof cached === 'string' ? JSON.parse(cached) : cached) as CGUAnalysisRule[]
    }

    const { data: rules, error } = await supabaseAdmin
      .from("ai_derived_rules")
      .select("*")
      .eq("status", "active")

    if (error || !rules) {
      console.error("Failed to load active AI rules:", error)
      return []
    }

    await riskRedis.cacheActiveRules(rules)
    return rules as CGUAnalysisRule[]
  },

  async run(merchantId: string): Promise<RuleViolation[]> {
    const rules = await this.loadActiveRules()
    const violations: RuleViolation[] = []

    for (const rule of rules) {
      // Exécution dynamique basée sur rule.detection_logic.type
      // Dans cette implémentation, on structure le framework d'exécution.
      
      try {
        let isViolated = false
        const logic = rule.detection_logic
        
        switch (logic.type) {
          case "transaction_pattern":
            // Ex: fetch supabase transactions for merchant in time_window
            break
          case "amount_threshold":
            // Ex: sum transactions > threshold
            break
          case "behavior_pattern":
            // Ex: check login failures or multi-account fingerprints
            break
          case "keyword_match":
            // Ex: regex on transaction metadata
            break
        }

        if (isViolated) {
          violations.push({
            merchantId,
            ruleName: rule.rule_name,
            riskPoints: rule.risk_points,
            legalBasis: rule.legal_basis,
            evidence: {
               matched_conditions: logic.conditions,
               timestamp: new Date().toISOString()
            }
          })
        }
      } catch (err) {
        console.error(`Error executing rule ${rule.rule_name}:`, err)
        // Ne pas crasher les autres règles
      }
    }

    return violations
  }
}
