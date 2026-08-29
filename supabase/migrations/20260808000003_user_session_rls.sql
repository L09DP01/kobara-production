-- Restrict direct Data API access to the current user's own sessions.
ALTER TABLE public.merchant_sessions
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS user_role VARCHAR(50) DEFAULT 'owner';

UPDATE public.merchant_sessions AS sessions
SET user_id = merchants.user_id
FROM public.merchants AS merchants
WHERE sessions.user_id IS NULL
  AND sessions.merchant_id = merchants.id;

DROP POLICY IF EXISTS "Merchant users can view their sessions" ON public.merchant_sessions;
DROP POLICY IF EXISTS "Merchant users can insert their sessions" ON public.merchant_sessions;
DROP POLICY IF EXISTS "Merchant users can update their sessions" ON public.merchant_sessions;
DROP POLICY IF EXISTS "Merchant users can delete their sessions" ON public.merchant_sessions;

CREATE POLICY "Users can view their own merchant sessions"
ON public.merchant_sessions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own merchant sessions"
ON public.merchant_sessions
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own merchant sessions"
ON public.merchant_sessions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own merchant sessions"
ON public.merchant_sessions
FOR DELETE
USING (user_id = auth.uid());
