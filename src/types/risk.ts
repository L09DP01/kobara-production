export type RiskLevel = "low" | "medium" | "high" | "critical" | "suspended"

export interface CGUAnalysisRule {
  rule_name: string
  rule_category: "prohibited_activity" | "aml" | "api_abuse" | "kyc_fraud" | "withdrawal_abuse" | "account_abuse"
  description: string
  legal_basis: string
  severity: "low" | "medium" | "high" | "critical"
  risk_points: number
  auto_action: "warn" | "restrict" | "freeze" | "flag_review" | "none"
  detection_logic: {
    type: "transaction_pattern" | "behavior_pattern" | "amount_threshold" | "keyword_match"
    description: string
    data_sources: string[]
    time_window_minutes: number
    threshold: number
    conditions: string[]
    redis_key_pattern: string
  }
}

export interface RuleViolation {
  merchantId: string
  ruleId?: string
  ruleName: string
  legalBasis?: string
  riskPoints: number
  evidence: any
}

export interface RuleDiffReport {
  new_rules: any[]
  updated_rules: any[]
  removed_rules: any[]
  unchanged_rules: any[]
}
