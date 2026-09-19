-- Merchant setup guide and sales-assisted Business plan requests.

CREATE TABLE IF NOT EXISTS public.merchant_setup_progress (
  merchant_id UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  integration_choice TEXT CHECK (integration_choice IN ('payment_link', 'api')),
  payment_methods_confirmed_at TIMESTAMPTZ,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.business_plan_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  requester_first_name TEXT NOT NULL,
  requester_last_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  professional_email TEXT NOT NULL,
  phone TEXT NOT NULL,
  legal_business_name TEXT NOT NULL,
  trading_name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  business_address TEXT NOT NULL,
  website_or_social TEXT,
  industry TEXT NOT NULL,
  business_description TEXT NOT NULL,
  products_services TEXT NOT NULL,
  desired_payment_methods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  primary_needs TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  additional_message TEXT,
  status TEXT NOT NULL DEFAULT 'new_request' CHECK (status IN (
    'new_request',
    'contact_required',
    'merchant_contacted',
    'kyb_pending',
    'kyb_in_progress',
    'information_required',
    'approved',
    'rejected',
    'plan_activated'
  )),
  admin_notes TEXT,
  contacted_at TIMESTAMPTZ,
  kyb_started_at TIMESTAMPTZ,
  kyb_approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_plan_requests_status_created
  ON public.business_plan_requests(status, created_at DESC);

DROP TRIGGER IF EXISTS update_merchant_setup_progress_modtime ON public.merchant_setup_progress;
CREATE TRIGGER update_merchant_setup_progress_modtime
  BEFORE UPDATE ON public.merchant_setup_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_business_plan_requests_modtime ON public.business_plan_requests;
CREATE TRIGGER update_business_plan_requests_modtime
  BEFORE UPDATE ON public.business_plan_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.merchant_setup_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_plan_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.merchant_setup_progress FROM anon, authenticated;
REVOKE ALL ON TABLE public.business_plan_requests FROM anon, authenticated;

COMMENT ON TABLE public.merchant_setup_progress IS
  'Server-managed progress for the merchant Live setup guide.';
COMMENT ON TABLE public.business_plan_requests IS
  'Sales-assisted Business plan requests; KYB and activation remain admin-controlled.';
