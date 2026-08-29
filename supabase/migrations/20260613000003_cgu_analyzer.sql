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
