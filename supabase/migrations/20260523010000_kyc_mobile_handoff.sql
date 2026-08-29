-- Migration to add Mobile Handoff fields to kyc_profiles

ALTER TABLE public.kyc_profiles
    ADD COLUMN IF NOT EXISTS mobile_handoff_token UUID,
    ADD COLUMN IF NOT EXISTS mobile_handoff_expires_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS mobile_handoff_completed BOOLEAN DEFAULT false;

-- Create an index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_kyc_profiles_mobile_handoff_token ON public.kyc_profiles(mobile_handoff_token);
