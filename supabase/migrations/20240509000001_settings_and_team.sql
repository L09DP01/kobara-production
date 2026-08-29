-- Table: merchant_members
CREATE TABLE public.merchant_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'developer',
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, email)
);

-- Add notifications_json to settings
ALTER TABLE public.settings ADD COLUMN notifications_json JSONB DEFAULT '{}'::JSONB;

-- Enable RLS for merchant_members
ALTER TABLE public.merchant_members ENABLE ROW LEVEL SECURITY;

-- Update get_current_merchant_id to support team members
CREATE OR REPLACE FUNCTION get_current_merchant_id() RETURNS UUID AS $$
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM public.merchant_members WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Policy
CREATE POLICY "Merchant users can view their team members" ON public.merchant_members FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert team members" ON public.merchant_members FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update team members" ON public.merchant_members FOR UPDATE USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can delete team members" ON public.merchant_members FOR DELETE USING (merchant_id = get_current_merchant_id());

CREATE TRIGGER update_merchant_members_modtime BEFORE UPDATE ON public.merchant_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
