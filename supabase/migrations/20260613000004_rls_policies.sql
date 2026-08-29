-- Disable client access to all risk tables
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE merchant_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_derived_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_violation_logs ENABLE ROW LEVEL SECURITY;

-- No policies meaning no access for anon/authenticated (only service_role can bypass RLS)
