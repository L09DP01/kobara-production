-- Migration: Email Campaigns & Batch Delivery System (System Core)
-- Supports throttling (7 emails/sec), daily drip batching (50 emails/day), and per-recipient tracking.

CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  content_html TEXT,
  audience_type TEXT NOT NULL DEFAULT 'merchants' CHECK (audience_type IN ('merchants', 'customers', 'users', 'all', 'custom')),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('draft', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled')),
  daily_limit INTEGER NOT NULL DEFAULT 50 CHECK (daily_limit > 0),
  rate_per_second INTEGER NOT NULL DEFAULT 7 CHECK (rate_per_second > 0 AND rate_per_second <= 20),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_batch_at TIMESTAMPTZ,
  sent_today_count INTEGER NOT NULL DEFAULT 0,
  last_sent_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'merchant' CHECK (recipient_type IN ('merchant', 'customer', 'user', 'custom')),
  recipient_id TEXT,
  batch_number INTEGER NOT NULL DEFAULT 1 CHECK (batch_number > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-performance querying
CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON public.email_campaigns(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_campaign_status ON public.email_campaign_recipients(campaign_id, status, batch_number);
CREATE INDEX IF NOT EXISTS idx_email_campaign_recipients_email ON public.email_campaign_recipients(recipient_email);

-- Enable RLS
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Admins and Service Role have full access
DROP POLICY IF EXISTS "Admins full access on email_campaigns" ON public.email_campaigns;
CREATE POLICY "Admins full access on email_campaigns"
  ON public.email_campaigns
  FOR ALL
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Admins full access on email_campaign_recipients" ON public.email_campaign_recipients;
CREATE POLICY "Admins full access on email_campaign_recipients"
  ON public.email_campaign_recipients
  FOR ALL
  TO authenticated, service_role
  USING (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    EXISTS (
      SELECT 1 FROM public.super_admins
      WHERE super_admins.email = auth.jwt() ->> 'email'
    ) OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role IN ('admin', 'super_admin')
    )
  );
