BEGIN;

CREATE TABLE public.shopify_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  shop_id BIGINT,
  shop_name TEXT,
  shop_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disconnected', 'uninstalled', 'error')),
  access_token_ciphertext TEXT,
  granted_scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  oauth_state_hash TEXT,
  installed_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  uninstalled_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopify_installations_merchant_unique UNIQUE (merchant_id),
  CONSTRAINT shopify_installations_shop_unique UNIQUE (shop_domain),
  CONSTRAINT shopify_installations_domain_check
    CHECK (shop_domain = LOWER(shop_domain) AND shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$')
);

CREATE TABLE public.shopify_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID NOT NULL REFERENCES public.shopify_installations(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  order_name TEXT,
  currency TEXT NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
  financial_status TEXT,
  fulfillment_status TEXT,
  kobara_status TEXT NOT NULL DEFAULT 'observed'
    CHECK (kobara_status IN ('observed', 'payment_link_ready', 'paid', 'cancelled', 'unsupported_currency', 'error')),
  payment_link_id UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  checkout_url TEXT,
  customer JSONB NOT NULL DEFAULT '{}'::JSONB,
  raw_order JSONB NOT NULL DEFAULT '{}'::JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopify_orders_installation_order_unique UNIQUE (installation_id, shopify_order_id)
);

CREATE TABLE public.shopify_webhook_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id UUID REFERENCES public.shopify_installations(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  webhook_id TEXT NOT NULL UNIQUE,
  shop_domain TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_shopify_installations_active_merchant
  ON public.shopify_installations (merchant_id)
  WHERE status = 'active';
CREATE INDEX idx_shopify_orders_merchant_created
  ON public.shopify_orders (merchant_id, created_at DESC);
CREATE INDEX idx_shopify_webhook_receipts_shop_received
  ON public.shopify_webhook_receipts (shop_domain, received_at DESC);
CREATE UNIQUE INDEX idx_payment_links_shopify_order_unique
  ON public.payment_links (
    (metadata ->> 'shopify_installation_id'),
    (metadata ->> 'shopify_order_id')
  )
  WHERE metadata ->> 'source' = 'shopify';

ALTER TABLE public.shopify_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_webhook_receipts ENABLE ROW LEVEL SECURITY;

-- Shopify credentials and webhook payloads are server-only. Dashboard reads
-- are intentionally performed through the service role after NextAuth checks.
REVOKE ALL ON public.shopify_installations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shopify_orders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shopify_webhook_receipts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shopify_installations TO service_role;
GRANT ALL ON public.shopify_orders TO service_role;
GRANT ALL ON public.shopify_webhook_receipts TO service_role;

COMMIT;
