-- Update get_current_merchant_id to secure it with search_path
CREATE OR REPLACE FUNCTION get_current_merchant_id() RETURNS UUID AS $$
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
    UNION
    SELECT merchant_id FROM public.merchant_members WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';
