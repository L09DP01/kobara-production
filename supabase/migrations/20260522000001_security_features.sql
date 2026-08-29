-- 1. Add address JSONB to merchants
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS address_json JSONB DEFAULT '{}'::JSONB;

-- 2. Create merchant_messages table
CREATE TABLE IF NOT EXISTS public.merchant_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    sender VARCHAR(255) DEFAULT 'system',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.merchant_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant users can view their messages" ON public.merchant_messages FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their messages" ON public.merchant_messages FOR UPDATE USING (merchant_id = get_current_merchant_id());

-- 3. Create user_passkeys table for WebAuthn
CREATE TABLE IF NOT EXISTS public.user_passkeys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    public_key BYTEA NOT NULL,
    counter BIGINT NOT NULL DEFAULT 0,
    transports JSONB DEFAULT '[]'::JSONB,
    device_type VARCHAR(100) DEFAULT 'singleDevice',
    backed_up BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.user_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own passkeys" ON public.user_passkeys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own passkeys" ON public.user_passkeys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own passkeys" ON public.user_passkeys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own passkeys" ON public.user_passkeys FOR DELETE USING (auth.uid() = user_id);

-- 4. Create merchant_sessions table
CREATE TABLE IF NOT EXISTS public.merchant_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(100),
    location VARCHAR(255),
    login_method VARCHAR(50) DEFAULT 'password',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.merchant_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchant users can view their sessions" ON public.merchant_sessions FOR SELECT USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can insert their sessions" ON public.merchant_sessions FOR INSERT WITH CHECK (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can update their sessions" ON public.merchant_sessions FOR UPDATE USING (merchant_id = get_current_merchant_id());
CREATE POLICY "Merchant users can delete their sessions" ON public.merchant_sessions FOR DELETE USING (merchant_id = get_current_merchant_id());

-- Triggers for modtime
CREATE TRIGGER update_merchant_messages_modtime BEFORE UPDATE ON public.merchant_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
