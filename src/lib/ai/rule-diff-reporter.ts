import { CGUAnalysisRule, RuleDiffReport } from "@/types/risk"

export function compareRuleSets(oldRules: CGUAnalysisRule[], newRules: CGUAnalysisRule[]): RuleDiffReport {
  const newRulesDetected: CGUAnalysisRule[] = []
  const updatedRules: CGUAnalysisRule[] = []
  const unchangedRules: CGUAnalysisRule[] = []
  const removedRules: CGUAnalysisRule[] = []

  const oldRulesMap = new Map(oldRules.map(r => [r.rule_name, r]))

  for (const newRule of newRules) {
    const oldRule = oldRulesMap.get(newRule.rule_name)
    if (!oldRule) {
      newRulesDetected.push(newRule)
    } else {
      // Compare les champs critiques pour détecter un changement de logique
      const isChanged = JSON.stringify(oldRule.detection_logic) !== JSON.stringify(newRule.detection_logic) ||
                        oldRule.severity !== newRule.severity ||
                        oldRule.risk_points !== newRule.risk_points ||
                        oldRule.auto_action !== newRule.auto_action ||
                        oldRule.legal_basis !== newRule.legal_basis
      
      if (isChanged) {
        updatedRules.push(newRule)
      } else {
        unchangedRules.push(newRule)
      }
      oldRulesMap.delete(newRule.rule_name)
    }
  }

  // Celles qui restent dans la map n'existent plus dans les nouvelles règles
  for (const oldRule of oldRulesMap.values()) {
    removedRules.push(oldRule)
  }

  return {
    new_rules: newRulesDetected,
    updated_rules: updatedRules,
    removed_rules: removedRules,
    unchanged_rules: unchangedRules
  }
}
