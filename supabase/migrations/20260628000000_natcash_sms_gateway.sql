-- Create sms_inbox table
CREATE TABLE IF NOT EXISTS public.sms_inbox (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_message TEXT NOT NULL,
    parsed_json JSONB DEFAULT '{}'::JSONB,
    source VARCHAR(50) DEFAULT 'natcash',
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processed, ignored, failed
    error_reason TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trans_code and expires_at to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS trans_code VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS for sms_inbox
ALTER TABLE public.sms_inbox ENABLE ROW LEVEL SECURITY;

-- Allow merchants to view their SMS inbox by linking through payment_id
-- If payment_id is null, it might be harder to link, but for now we'll allow access if linked to a payment of the merchant
CREATE POLICY "Merchant users can view their linked SMS" 
ON public.sms_inbox 
FOR SELECT 
USING (
    payment_id IN (
        SELECT id FROM public.payments WHERE merchant_id = get_current_merchant_id()
    )
);

-- Note: We might need a way for admins to see ALL unlinked SMS, 
-- or we can link SMS to merchant_id directly if we can determine the merchant from the receiver's phone number.
-- For now, the webhook (Service Role) will have bypass RLS to insert and update.

-- Trigger for updated_at timestamps (though we don't have updated_at yet on sms_inbox, we can add it later if needed)
