-- Création de la table promo_codes
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percentage DECIMAL(5,2) NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE NULL,
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NULL,
    is_cumulable BOOLEAN DEFAULT false,
    is_recurring BOOLEAN DEFAULT false,
    max_uses INTEGER NULL CHECK (max_uses > 0 OR max_uses IS NULL),
    current_uses INTEGER DEFAULT 0,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Admins (via service role) can do everything. 
-- Merchants can only read active promo codes (useful for validation endpoint).
CREATE POLICY "Promo codes are viewable by everyone" ON public.promo_codes
    FOR SELECT USING (is_active = true);
