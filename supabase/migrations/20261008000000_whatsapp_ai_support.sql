BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL UNIQUE,
  display_name TEXT,
  email TEXT,
  email_verified_at TIMESTAMPTZ,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  memory_summary TEXT,
  locale TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'human', 'closed')),
  ai_paused_until TIMESTAMPTZ,
  assigned_admin_id UUID REFERENCES public.super_admins(id) ON DELETE SET NULL,
  summary TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_inbound_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  provider_message_id TEXT UNIQUE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'assistant', 'admin', 'system')),
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'document', 'interactive', 'system')),
  body TEXT,
  media_id TEXT,
  mime_type TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'received',
  knowledge_sources JSONB NOT NULL DEFAULT '[]'::JSONB,
  model TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_identity_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.support_system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error', 'critical')),
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_merchant ON public.whatsapp_contacts (merchant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_email ON public.whatsapp_contacts (LOWER(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contact_recent ON public.whatsapp_conversations (contact_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status_recent ON public.whatsapp_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_created ON public.whatsapp_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_challenges_contact_created ON public.whatsapp_identity_challenges (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_system_logs_merchant_created ON public.support_system_logs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_system_logs_conversation_created ON public.support_system_logs (conversation_id, created_at DESC);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_identity_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_system_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.whatsapp_contacts FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_conversations FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_messages FROM anon, authenticated;
REVOKE ALL ON public.whatsapp_identity_challenges FROM anon, authenticated;
REVOKE ALL ON public.support_system_logs FROM anon, authenticated;

GRANT ALL ON public.whatsapp_contacts TO service_role;
GRANT ALL ON public.whatsapp_conversations TO service_role;
GRANT ALL ON public.whatsapp_messages TO service_role;
GRANT ALL ON public.whatsapp_identity_challenges TO service_role;
GRANT ALL ON public.support_system_logs TO service_role;

COMMIT;
