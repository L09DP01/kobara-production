-- Add user_id, user_email, and user_role to merchant_sessions
ALTER TABLE public.merchant_sessions 
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50) DEFAULT 'owner';
