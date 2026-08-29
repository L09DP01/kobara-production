-- Migration: Telegram Bot Integration for Kobara (Live-only merchant assistant & community broadcast)

CREATE TABLE IF NOT EXISTS public.merchant_telegram_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  telegram_chat_id TEXT NOT NULL,
  telegram_username TEXT,
  first_name TEXT,
  notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  session_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_merchant_telegram_chat UNIQUE(telegram_chat_id),
  CONSTRAINT uq_merchant_telegram_merchant UNIQUE(merchant_id)
);

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_merchant_telegram_chat_id ON public.merchant_telegram_accounts(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_merchant_telegram_merchant_id ON public.merchant_telegram_accounts(merchant_id);
CREATE INDEX IF NOT EXISTS idx_telegram_link_tokens_token ON public.telegram_link_tokens(token, expires_at);

-- RLS
ALTER TABLE public.merchant_telegram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view and manage their own telegram link"
  ON public.merchant_telegram_accounts
  FOR ALL
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.id = merchant_telegram_accounts.merchant_id
      AND merchants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.id = merchant_telegram_accounts.merchant_id
      AND merchants.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants can generate telegram tokens"
  ON public.telegram_link_tokens
  FOR ALL
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.id = telegram_link_tokens.merchant_id
      AND merchants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.merchants
      WHERE merchants.id = telegram_link_tokens.merchant_id
      AND merchants.user_id = auth.uid()
    )
  );
