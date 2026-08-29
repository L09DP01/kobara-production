ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'merchant' CHECK (role IN ('merchant', 'admin', 'compliance', 'super_admin'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update foreign keys that were using admin_users
ALTER TABLE risk_alerts DROP CONSTRAINT IF EXISTS risk_alerts_resolved_by_fkey;
ALTER TABLE risk_alerts ADD CONSTRAINT risk_alerts_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users(id);

ALTER TABLE merchant_restrictions DROP CONSTRAINT IF EXISTS merchant_restrictions_applied_by_fkey;
ALTER TABLE merchant_restrictions ADD CONSTRAINT merchant_restrictions_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES users(id);

ALTER TABLE merchant_restrictions DROP CONSTRAINT IF EXISTS merchant_restrictions_lifted_by_fkey;
ALTER TABLE merchant_restrictions ADD CONSTRAINT merchant_restrictions_lifted_by_fkey FOREIGN KEY (lifted_by) REFERENCES users(id);

ALTER TABLE compliance_cases DROP CONSTRAINT IF EXISTS compliance_cases_assigned_to_fkey;
ALTER TABLE compliance_cases ADD CONSTRAINT compliance_cases_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id);

ALTER TABLE legal_documents DROP CONSTRAINT IF EXISTS legal_documents_uploaded_by_fkey;
ALTER TABLE legal_documents ADD CONSTRAINT legal_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES users(id);

ALTER TABLE ai_derived_rules DROP CONSTRAINT IF EXISTS ai_derived_rules_reviewed_by_fkey;
ALTER TABLE ai_derived_rules ADD CONSTRAINT ai_derived_rules_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id);

ALTER TABLE admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_admin_id_fkey;
ALTER TABLE admin_audit_logs ADD CONSTRAINT admin_audit_logs_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES users(id);

DROP TABLE IF EXISTS admin_users CASCADE;
