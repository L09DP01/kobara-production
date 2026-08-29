-- Add new columns to merchants table
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS plan_slug VARCHAR(50) DEFAULT 'test_only',
ADD COLUMN IF NOT EXISTS plan_status VARCHAR(50) DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS account_access VARCHAR(50) DEFAULT 'test',
ADD COLUMN IF NOT EXISTS kyc_status VARCHAR(50) DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS kyc_verified_at TIMESTAMP WITH TIME ZONE;

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price_htg DECIMAL(15,2) DEFAULT 0,
    monthly_payment_limit INTEGER NULL,
    api_keys_limit INTEGER NULL,
    transaction_fee_percent DECIMAL(5,2),
    daily_withdrawal_limit DECIMAL(15,2) NULL,
    wordpress_plugin BOOLEAN DEFAULT true,
    webhooks_level VARCHAR(50) DEFAULT 'basic',
    analytics_level VARCHAR(50) DEFAULT 'basic',
    support_level VARCHAR(50) DEFAULT 'community',
    is_contact_sales BOOLEAN DEFAULT false,
    features JSONB DEFAULT '[]',
    limits JSONB DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'active',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES public.plans(id),
    status VARCHAR(50) DEFAULT 'active',
    billing_cycle VARCHAR(50) DEFAULT 'monthly',
    amount_htg DECIMAL(15,2) DEFAULT 0,
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT false,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
    invoice_number VARCHAR(100) UNIQUE,
    amount_htg DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50),
    paid_at TIMESTAMP WITH TIME ZONE,
    due_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Setup
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Plans policies
CREATE POLICY "Plans are viewable by everyone" ON public.plans
    FOR SELECT
    USING (true);

-- Subscriptions policies
CREATE POLICY "Merchants can view their own subscriptions" ON public.subscriptions
    FOR SELECT
    USING (merchant_id = public.get_current_merchant_id());

-- Invoices policies
CREATE POLICY "Merchants can view their own invoices" ON public.invoices
    FOR SELECT
    USING (merchant_id = public.get_current_merchant_id());

-- Insert default plans
INSERT INTO public.plans (
    slug, name, price_htg, monthly_payment_limit, api_keys_limit, 
    transaction_fee_percent, daily_withdrawal_limit, wordpress_plugin, 
    webhooks_level, analytics_level, support_level, is_contact_sales, sort_order
) VALUES 
(
    'free', 'Gratuit', 0, 10, 1, 4.00, 2500, true, 
    'basic', 'basic', 'community', false, 1
),
(
    'pro', 'Pro', 1750, null, null, 2.90, 20000, true, 
    'advanced', 'standard', 'priority_email', false, 2
),
(
    'premium', 'Premium', 5000, null, null, 2.90, 50000, true, 
    'advanced_logs', 'advanced', 'priority_email_chat', false, 3
),
(
    'business', 'Business', 12500, null, null, 2.90, null, true, 
    'enterprise', 'enterprise', 'priority_24_7', true, 4
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price_htg = EXCLUDED.price_htg,
    monthly_payment_limit = EXCLUDED.monthly_payment_limit,
    api_keys_limit = EXCLUDED.api_keys_limit,
    transaction_fee_percent = EXCLUDED.transaction_fee_percent,
    daily_withdrawal_limit = EXCLUDED.daily_withdrawal_limit,
    wordpress_plugin = EXCLUDED.wordpress_plugin,
    webhooks_level = EXCLUDED.webhooks_level,
    analytics_level = EXCLUDED.analytics_level,
    support_level = EXCLUDED.support_level,
    is_contact_sales = EXCLUDED.is_contact_sales,
    sort_order = EXCLUDED.sort_order;
