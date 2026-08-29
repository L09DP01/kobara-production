-- Migration pour le support des Push Notifications Expo
CREATE TABLE IF NOT EXISTS public.merchant_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    device_info JSONB DEFAULT '{}'::JSONB,
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merchant_id, expo_push_token)
);

ALTER TABLE public.merchant_devices ENABLE ROW LEVEL SECURITY;

-- Ajout des préférences de notification sur la table merchants
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"payments": true, "withdrawals": true, "transfers": true, "security": true}'::JSONB;

-- Policies for merchant_devices
CREATE POLICY "Merchants can manage their own devices" ON public.merchant_devices
    FOR ALL
    USING (merchant_id IN (
        SELECT id FROM public.merchants WHERE user_id = auth.uid()
    ));
