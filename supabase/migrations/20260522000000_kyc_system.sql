-- Create KYC Profiles Table
CREATE TABLE IF NOT EXISTS public.kyc_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'not_started',
    document_type VARCHAR(50),
    document_country VARCHAR(10),
    full_name VARCHAR(255),
    document_number_hash TEXT,
    date_of_birth DATE,
    document_front_url TEXT,
    document_back_url TEXT,
    selfie_url TEXT,
    liveness_score DECIMAL(5,2),
    face_match_score DECIMAL(5,2),
    document_score DECIMAL(5,2),
    risk_score DECIMAL(5,2),
    rejection_reason TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create KYC Events Table for audit trail
CREATE TABLE IF NOT EXISTS public.kyc_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    kyc_profile_id UUID REFERENCES public.kyc_profiles(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Note: 'merchants' table already has kyc_status, kyc_verified_at, plan_slug, plan_status, account_access 
-- from previous migrations. Just in case, ensure they exist:
ALTER TABLE public.merchants 
    ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS account_access VARCHAR(50) DEFAULT 'test';

-- Enable RLS
ALTER TABLE public.kyc_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_events ENABLE ROW LEVEL SECURITY;

-- Security Policies for KYC
-- Merchants can only VIEW their own KYC profile.
-- INSERT and UPDATE are done by the backend (using admin client / service_role).
CREATE POLICY "Merchants can view their own kyc profile" ON public.kyc_profiles
    FOR SELECT USING (merchant_id = public.get_current_merchant_id());

CREATE POLICY "Merchants can view their own kyc events" ON public.kyc_events
    FOR SELECT USING (merchant_id = public.get_current_merchant_id());

-- Configure Supabase Storage Bucket for KYC Documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'kyc_documents', 
    'kyc_documents', 
    false, 
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- RLS for Storage Bucket (kyc_documents)
-- We DO NOT add any SELECT/INSERT/UPDATE policies for authenticated users.
-- This ensures that NO ONE can access or upload to the bucket directly from the browser.
-- Only the Next.js Server (using service_role key) can upload and generate signed URLs.
