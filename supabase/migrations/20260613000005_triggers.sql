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
