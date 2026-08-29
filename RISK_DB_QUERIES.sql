CREATE TABLE IF NOT EXISTS admin_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'compliance', 'super_admin')),
  name          TEXT,
  is_active     BOOLEAN DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
-- merchant_risk_scores
CREATE TABLE IF NOT EXISTS merchant_risk_scores (
  merchant_id UUID PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical', 'suspended')),
  last_updated_at TIMESTAMPTZ DEFAULT now()
);

-- risk_events
CREATE TABLE IF NOT EXISTS risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  description TEXT NOT NULL,
  risk_points INTEGER NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- risk_alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
  description TEXT NOT NULL,
  resolved_by UUID REFERENCES admin_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- merchant_restrictions
CREATE TABLE IF NOT EXISTS merchant_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  applied_by UUID REFERENCES admin_users(id),
  lifted_by UUID REFERENCES admin_users(id),
  lifted_at TIMESTAMPTZ,
  lift_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- compliance_cases
CREATE TABLE IF NOT EXISTS compliance_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  case_status TEXT NOT NULL DEFAULT 'open' CHECK (case_status IN ('open', 'under_review', 'action_required', 'closed')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES admin_users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- risk_score_history
CREATE TABLE IF NOT EXISTS risk_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  old_score INTEGER NOT NULL,
  new_score INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- monitoring_jobs
CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  merchants_scanned INTEGER DEFAULT 0,
  alerts_generated INTEGER DEFAULT 0,
  error_message TEXT
);
CREATE TABLE IF NOT EXISTS legal_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_type        TEXT NOT NULL DEFAULT 'cgu',
  version         TEXT NOT NULL,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  content_hash    TEXT NOT NULL,
  analyzed_at     TIMESTAMPTZ,
  analysis_status TEXT DEFAULT 'pending'
                  CHECK (analysis_status IN ('pending','analyzing','done','failed')),
  rules_generated INTEGER DEFAULT 0,
  uploaded_by     UUID REFERENCES admin_users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  is_active       BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS ai_derived_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_doc_id    UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
  rule_name       TEXT NOT NULL,
  rule_category   TEXT NOT NULL,
  description     TEXT NOT NULL,
  legal_basis     TEXT NOT NULL,
  detection_logic JSONB NOT NULL,
  severity        TEXT CHECK (severity IN ('low','medium','high','critical')),
  risk_points     INTEGER CHECK (risk_points BETWEEN 5 AND 50),
  auto_action     TEXT,
  status          TEXT DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review','active','rejected','superseded')),
  reviewed_by     UUID REFERENCES admin_users(id),
  reviewed_at     TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rule_violation_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     UUID REFERENCES merchants(id) ON DELETE CASCADE,
  rule_id         UUID REFERENCES ai_derived_rules(id) ON DELETE CASCADE,
  rule_name       TEXT NOT NULL,
  legal_basis     TEXT NOT NULL,
  evidence        JSONB NOT NULL,
  risk_points     INTEGER,
  action_taken    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ADD COLUMN rule_id TO risk_alerts
ALTER TABLE risk_alerts 
ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES ai_derived_rules(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_rules_status ON ai_derived_rules(status);
CREATE INDEX IF NOT EXISTS idx_ai_rules_doc ON ai_derived_rules(legal_doc_id);
CREATE INDEX IF NOT EXISTS idx_violations_merchant ON rule_violation_logs(merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_violations_rule ON rule_violation_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_docs_active ON legal_documents(is_active) WHERE is_active = true;
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
-- Trigger : set_single_active_document
CREATE OR REPLACE FUNCTION set_single_active_document()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE legal_documents
    SET is_active = false
    WHERE doc_type = NEW.doc_type
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_active_doc_trigger ON legal_documents;

CREATE TRIGGER ensure_single_active_doc_trigger
BEFORE INSERT OR UPDATE OF is_active ON legal_documents
FOR EACH ROW
WHEN (NEW.is_active = true)
EXECUTE FUNCTION set_single_active_document();

-- Trigger : auto_update_updated_at for ai_derived_rules
CREATE OR REPLACE FUNCTION update_ai_derived_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ai_derived_rules_updated_at ON ai_derived_rules;

CREATE TRIGGER trigger_update_ai_derived_rules_updated_at
BEFORE UPDATE ON ai_derived_rules
FOR EACH ROW
EXECUTE FUNCTION update_ai_derived_rules_updated_at();

-- Note: The admin_audit_logs trigger requested in the prompt
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES admin_users(id),
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  before_state JSONB,
  after_state JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION log_ai_rule_activation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status != 'active' THEN
    INSERT INTO admin_audit_logs (action, target_table, target_id, before_state, after_state)
    VALUES (
      'ACTIVATE_AI_RULE',
      'ai_derived_rules',
      NEW.id,
      row_to_json(OLD)::jsonb,
      row_to_json(NEW)::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_ai_rule_activation ON ai_derived_rules;

CREATE TRIGGER trigger_log_ai_rule_activation
AFTER UPDATE OF status ON ai_derived_rules
FOR EACH ROW
EXECUTE FUNCTION log_ai_rule_activation();
