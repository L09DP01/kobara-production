-- Migration: System Settings for Payment Providers (Bazik / Pay'm)
-- Description: Creates the system_settings table to persist platform-wide configurations

CREATE TABLE IF NOT EXISTS public.system_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON public.system_settings(key);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only service role / admins can read and write system settings
CREATE POLICY "Allow service_role full access to system_settings"
  ON public.system_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Insert default provider configuration
INSERT INTO public.system_settings (key, value)
VALUES (
  'payment_provider_config',
  '{
    "active_provider": "bazik",
    "sms_gateway_enabled": true,
    "paym_moncash_web": true,
    "paym_moncash_ussd": true,
    "paym_natcash_web": true,
    "paym_natcash_ussd": true
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
