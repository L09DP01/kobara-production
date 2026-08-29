-- Create KYC Liveness Challenges Table
CREATE TABLE IF NOT EXISTS public.kyc_liveness_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    challenge_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    result_score DECIMAL(5,2),
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.kyc_liveness_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can view their own liveness challenges" ON public.kyc_liveness_challenges
    FOR SELECT USING (merchant_id = public.get_current_merchant_id());

-- Add missing columns to kyc_profiles to avoid recreating the whole table
ALTER TABLE public.kyc_profiles
    ADD COLUMN IF NOT EXISTS document_capture_method VARCHAR(50) DEFAULT 'camera',
    ADD COLUMN IF NOT EXISTS passport_page_url TEXT,
    ADD COLUMN IF NOT EXISTS document_front_hash TEXT,
    ADD COLUMN IF NOT EXISTS document_back_hash TEXT,
    ADD COLUMN IF NOT EXISTS passport_page_hash TEXT,
    ADD COLUMN IF NOT EXISTS selfie_hash TEXT,
    ADD COLUMN IF NOT EXISTS liveness_challenge_id UUID REFERENCES public.kyc_liveness_challenges(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ocr_score DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS name_match_score DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS decision_source VARCHAR(50) DEFAULT 'backend',
    ADD COLUMN IF NOT EXISTS gemini_review JSONB DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS backend_decision JSONB DEFAULT '{}'::JSONB;

-- Note: The storage bucket 'kyc_documents' already exists and is private.
-- We will continue using it instead of creating 'kyc_documents_secure' to avoid duplication.
