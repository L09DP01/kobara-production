ALTER TABLE public.kyc_profiles
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS risk_score DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS gemini_review JSONB,
  ADD COLUMN IF NOT EXISTS backend_decision JSONB,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP WITH TIME ZONE;

-- Also fix any existing kyc_profiles that should be in review based on merchants table
UPDATE public.kyc_profiles 
SET status = 'in_review' 
WHERE merchant_id IN (
    SELECT id FROM public.merchants WHERE kyc_status = 'in_review'
);
