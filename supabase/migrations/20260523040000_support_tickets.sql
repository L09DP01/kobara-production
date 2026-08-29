CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'open', -- open, pending_admin, pending_merchant, closed
    priority VARCHAR(50) DEFAULT 'normal', -- low, normal, high, urgent
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL, -- merchant or admin
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tickets_merchant_access" ON public.support_tickets FOR ALL USING (auth.uid() = merchant_id);
CREATE POLICY "messages_merchant_access" ON public.ticket_messages FOR ALL USING (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE merchant_id = auth.uid())
);

-- Admin has full access via service_role
CREATE POLICY "tickets_service_role" ON public.support_tickets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "messages_service_role" ON public.ticket_messages FOR ALL USING (auth.role() = 'service_role');
