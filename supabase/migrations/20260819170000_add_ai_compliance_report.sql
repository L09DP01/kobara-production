-- Migration: 20260819170000_add_ai_compliance_report.sql
-- Description: Ajout du rapport d'analyse AI Compliance sur kyc_fraud_cases

ALTER TABLE public.kyc_fraud_cases
ADD COLUMN IF NOT EXISTS ai_compliance_report JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ai_report_status TEXT DEFAULT 'pending' CHECK (ai_report_status IN ('pending', 'completed', 'failed', 'fallback', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_ai_status ON public.kyc_fraud_cases(ai_report_status);
