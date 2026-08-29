-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: merchants
CREATE TABLE public.merchants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    business_slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    address TEXT,
    category VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    available_balance DECIMAL(15, 2) DEFAULT 0.00,
    pending_balance DECIMAL(15, 2) DEFAULT 0.00,
    reserved_balance DECIMAL(15, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'HTG',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: customers
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    wallet VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, email),
    UNIQUE(merchant_id, phone)
);

-- Table: payment_links
CREATE TABLE public.payment_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(15, 2),
    currency VARCHAR(10) DEFAULT 'HTG',
    slug VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    success_url TEXT,
    error_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: payments
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
    kobara_reference VARCHAR(255) UNIQUE NOT NULL,
    bazik_order_id VARCHAR(255),
    bazik_transaction_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    fee_amount DECIMAL(15, 2) DEFAULT 0.00,
    net_amount DECIMAL(15, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'HTG',
    status VARCHAR(50) DEFAULT 'pending',
    provider VARCHAR(50) DEFAULT 'moncash',
    payment_method VARCHAR(50),
    success_url TEXT,
    error_url TEXT,
    webhook_url TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Table: withdrawals
CREATE TABLE public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    kobara_reference VARCHAR(255) UNIQUE NOT NULL,
    bazik_transaction_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    fees DECIMAL(15, 2) DEFAULT 0.00,
    total DECIMAL(15, 2) NOT NULL,
    wallet VARCHAR(255) NOT NULL,
    customer_first_name VARCHAR(255),
    customer_last_name VARCHAR(255),
    customer_email VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    provider VARCHAR(50) DEFAULT 'moncash',
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    failed_reason TEXT
);

-- Table: api_keys
CREATE TABLE public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    prefix VARCHAR(50) NOT NULL,
    key_hash TEXT NOT NULL,
    environment VARCHAR(50) DEFAULT 'live',
    last_used_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: webhook_endpoints
CREATE TABLE public.webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events JSONB NOT NULL DEFAULT '[]'::JSONB,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: webhook_events
CREATE TABLE public.webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    webhook_endpoint_id UUID REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    delivery_status VARCHAR(50) DEFAULT 'pending',
    response_status INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: audit_logs
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: settings
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE UNIQUE,
    transaction_fee_percent DECIMAL(5, 2) DEFAULT 0.00,
    settlement_method VARCHAR(50) DEFAULT 'manual',
    webhook_default_url TEXT,
    branding_json JSONB DEFAULT '{}'::JSONB,
    security_json JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Merchants: Users can only read/update their own merchant row
CREATE POLICY "Users can view their own merchant" ON public.merchants FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own merchant" ON public.merchants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own merchant" ON public.merchants FOR UPDATE USING (auth.uid() = user_id);

-- Helper function to get current merchant_id securely
CREATE OR REPLACE FUNCTION get_current_merchant_id() RETURNS UUID AS $$
    SELECT id FROM public.merchants WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Apply RLS policies to all merchant-related tables
-- Customers
CREATE POLICY "Merchant users can view their customers" ON public.customers FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their customers" ON public.customers FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their customers" ON public.customers FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Payment Links
CREATE POLICY "Merchant users can view their payment links" ON public.payment_links FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their payment links" ON public.payment_links FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their payment links" ON public.payment_links FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Payments
CREATE POLICY "Merchant users can view their payments" ON public.payments FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their payments" ON public.payments FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their payments" ON public.payments FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Withdrawals
CREATE POLICY "Merchant users can view their withdrawals" ON public.withdrawals FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());

-- API Keys
CREATE POLICY "Merchant users can view their api keys" ON public.api_keys FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their api keys" ON public.api_keys FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their api keys" ON public.api_keys FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Webhooks
CREATE POLICY "Merchant users can view their webhook endpoints" ON public.webhook_endpoints FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their webhook endpoints" ON public.webhook_endpoints FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their webhook endpoints" ON public.webhook_endpoints FOR UPDATE USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can delete their webhook endpoints" ON public.webhook_endpoints FOR DELETE USING (merchant_id = get_current_merchant_id());

-- Webhook Events
CREATE POLICY "Merchant users can view their webhook events" ON public.webhook_events FOR SELECT USING (merchant_id = get_current_merchant_id());

-- Audit Logs
CREATE POLICY "Merchant users can view their audit logs" ON public.audit_logs FOR SELECT USING (merchant_id = get_current_merchant_id());

-- Notifications
CREATE POLICY "Merchant users can view their notifications" ON public.notifications FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their notifications" ON public.notifications FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Settings
CREATE POLICY "Merchant users can view their settings" ON public.settings FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their settings" ON public.settings FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_merchants_modtime BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_links_modtime BEFORE UPDATE ON public.payment_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_modtime BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_withdrawals_modtime BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_endpoints_modtime BEFORE UPDATE ON public.webhook_endpoints FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_events_modtime BEFORE UPDATE ON public.webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_modtime BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
