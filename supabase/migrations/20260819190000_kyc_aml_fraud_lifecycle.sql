-- Migration: 20260819190000_kyc_aml_fraud_lifecycle.sql
-- Invariants AML/CFT & BRH: Conservation obligatoire des données (No Hard Delete),
-- Réactivation conditionnelle du compte légitime (A) via re-vérification KYC Didit,
-- et procédure de restitution des fonds sous 190 jours pour le compte dupliqué (B).

-- 1. Extension de la table kyc_fraud_cases pour gérer la résolution AML
ALTER TABLE public.kyc_fraud_cases
  ADD COLUMN IF NOT EXISTS primary_verdict VARCHAR(64) DEFAULT 'under_investigation',
  ADD COLUMN IF NOT EXISTS related_verdict VARCHAR(64) DEFAULT 'under_investigation',
  ADD COLUMN IF NOT EXISTS payout_status VARCHAR(64) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_details JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payout_deadline_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;

-- Index de recherche rapide pour la compliance
CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_verdict_primary ON public.kyc_fraud_cases(primary_verdict);
CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_payout_status ON public.kyc_fraud_cases(payout_status);

-- 2. Table des demandes de versement de clôture (merchant_closure_payout_requests)
CREATE TABLE IF NOT EXISTS public.merchant_closure_payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fraud_case_id UUID REFERENCES public.kyc_fraud_cases(id) ON DELETE CASCADE NOT NULL,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    payout_method VARCHAR(32) NOT NULL, -- 'moncash', 'natcash', 'bank'
    payout_account_number TEXT NOT NULL,
    payout_account_name TEXT NOT NULL,
    document_proof_url TEXT,
    status VARCHAR(32) DEFAULT 'submitted', -- 'submitted', 'approved', 'paid', 'rejected'
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closure_payout_requests_merchant ON public.merchant_closure_payout_requests(merchant_id);
CREATE INDEX IF NOT EXISTS idx_closure_payout_requests_fraud_case ON public.merchant_closure_payout_requests(fraud_case_id);

-- RLS
ALTER TABLE public.merchant_closure_payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on merchant_closure_payout_requests" ON public.merchant_closure_payout_requests
    FOR ALL USING (auth.role() = 'service_role');
