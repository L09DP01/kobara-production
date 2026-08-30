BEGIN;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS public_id TEXT,
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS recipient_email TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'dashboard';

UPDATE public.support_tickets AS ticket
SET
  public_id = COALESCE(
    ticket.public_id,
    'KBR' || UPPER(SUBSTRING(REPLACE(ticket.id::TEXT, '-', '') FROM 1 FOR 12))
  ),
  requester_name = COALESCE(ticket.requester_name, merchant.business_name),
  requester_email = COALESCE(ticket.requester_email, merchant.email)
FROM public.merchants AS merchant
WHERE merchant.id = ticket.merchant_id;

UPDATE public.support_tickets
SET public_id = 'KBR' || UPPER(SUBSTRING(REPLACE(id::TEXT, '-', '') FROM 1 FOR 12))
WHERE public_id IS NULL;

ALTER TABLE public.support_tickets
  ALTER COLUMN public_id SET DEFAULT (
    'KBR' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 12))
  ),
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_public_id
  ON public.support_tickets (public_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_requester_email
  ON public.support_tickets (LOWER(requester_email))
  WHERE requester_email IS NOT NULL;

ALTER TABLE public.ticket_messages
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ticket_messages_external_message_id
  ON public.ticket_messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

COMMIT;
