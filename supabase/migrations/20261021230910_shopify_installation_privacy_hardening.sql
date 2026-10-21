BEGIN;

ALTER TABLE public.shopify_orders ADD COLUMN privacy_redacted_at timestamptz;
UPDATE public.shopify_installations SET shop_email = NULL;

CREATE TABLE public.shopify_oauth_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain text NOT NULL CHECK (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  browser_hash text NOT NULL,
  nonce_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exchanging', 'authorized', 'claimed')),
  installation_data jsonb,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 minutes'
);
CREATE INDEX ON public.shopify_oauth_handoffs (expires_at);

CREATE TABLE public.shopify_privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id text NOT NULL UNIQUE,
  shop_domain text NOT NULL,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  topic text NOT NULL CHECK (topic IN ('customers/data_request','customers/redact','shop/redact')),
  request_details_ciphertext text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  assigned_to uuid REFERENCES public.super_admins(id) ON DELETE SET NULL,
  completion_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  completed_at timestamptz,
  CHECK (status <> 'completed' OR (completed_at IS NOT NULL AND completion_reference IS NOT NULL))
);
CREATE INDEX ON public.shopify_privacy_requests (status, created_at);

ALTER TABLE public.shopify_oauth_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopify_privacy_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shopify_oauth_handoffs, public.shopify_privacy_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.shopify_oauth_handoffs, public.shopify_privacy_requests TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.minimize_shopify_order() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE source jsonb := COALESCE(NEW.raw_order, '{}'::jsonb);
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.privacy_redacted_at IS NOT NULL THEN
    NEW.privacy_redacted_at := OLD.privacy_redacted_at;
  END IF;
  IF NEW.privacy_redacted_at IS NOT NULL THEN
    NEW.customer := '{}'::jsonb;
    NEW.raw_order := '{}'::jsonb;
    RETURN NEW;
  END IF;
  NEW.customer := jsonb_strip_nulls(jsonb_build_object('id', NEW.customer->'id', 'email', NEW.customer->'email'));
  NEW.raw_order := jsonb_strip_nulls(jsonb_build_object(
    'id', source->'id', 'currency', source->'currency', 'total_price', source->'total_price',
    'current_total_price', source->'current_total_price', 'financial_status', source->'financial_status',
    'payment_gateway_names', source->'payment_gateway_names', 'cancelled_at', source->'cancelled_at',
    'test', source->'test', 'line_items', (
      SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'title', item->'title', 'name', item->'name', 'quantity', item->'quantity'
      ))), '[]'::jsonb)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source->'line_items') = 'array'
        THEN source->'line_items' ELSE '[]'::jsonb END) item
    )
  ));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.minimize_shopify_order() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.minimize_shopify_order() TO service_role;
CREATE TRIGGER minimize_shopify_order BEFORE INSERT OR UPDATE ON public.shopify_orders
  FOR EACH ROW EXECUTE FUNCTION private.minimize_shopify_order();
-- Minimize existing mirrored orders too; financial payment records are not deleted.
UPDATE public.shopify_orders SET raw_order = raw_order;

-- Process all matching orders atomically, without the REST API's default row limit.
CREATE OR REPLACE FUNCTION public.redact_shopify_customer(
  target_installation_id uuid, customer_id_value text, order_id_values text[]
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  UPDATE public.payment_links SET status = 'inactive' WHERE id IN (
    SELECT payment_link_id FROM public.shopify_orders WHERE installation_id = target_installation_id
      AND ((customer_id_value <> '' AND customer->>'id' = customer_id_value)
        OR shopify_order_id = ANY(COALESCE(order_id_values, ARRAY[]::text[])))
  );
  UPDATE public.shopify_orders SET customer = '{}'::jsonb, raw_order = '{}'::jsonb, privacy_redacted_at = now()
    WHERE installation_id = target_installation_id
      AND ((customer_id_value <> '' AND customer->>'id' = customer_id_value)
        OR shopify_order_id = ANY(COALESCE(order_id_values, ARRAY[]::text[])));
END $$;
REVOKE ALL ON FUNCTION public.redact_shopify_customer(uuid,text,text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redact_shopify_customer(uuid,text,text[]) TO service_role;

CREATE OR REPLACE FUNCTION public.redact_shopify_shop(shop_domain_value text) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Same lock order as account linking: handoff first, installation second.
  DELETE FROM public.shopify_oauth_handoffs WHERE shop_domain = shop_domain_value;
  UPDATE public.payment_links SET status = 'inactive' WHERE metadata->>'shopify_installation_id' IN (
    SELECT id::text FROM public.shopify_installations WHERE shop_domain = shop_domain_value
  );
  DELETE FROM public.shopify_installations WHERE shop_domain = shop_domain_value;
END $$;
REVOKE ALL ON FUNCTION public.redact_shopify_shop(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redact_shopify_shop(text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_shopify_oauth_handoff(
  handoff_id uuid, browser_hash_value text, owner_merchant_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE handoff public.shopify_oauth_handoffs%ROWTYPE;
        existing public.shopify_installations%ROWTYPE;
        result_id uuid;
BEGIN
  SELECT * INTO handoff FROM public.shopify_oauth_handoffs WHERE id = handoff_id FOR UPDATE;
  IF NOT FOUND OR handoff.status <> 'authorized' OR handoff.expires_at <= now()
    OR handoff.browser_hash IS DISTINCT FROM browser_hash_value THEN RAISE EXCEPTION 'invalid_handoff'; END IF;
  PERFORM id FROM public.merchants WHERE id = owner_merchant_id AND kyc_status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'kyc_required'; END IF;
  SELECT * INTO existing FROM public.shopify_installations WHERE merchant_id = owner_merchant_id FOR UPDATE;
  IF FOUND AND existing.shop_domain <> handoff.shop_domain THEN
    RAISE EXCEPTION 'different_shop_requires_support';
  END IF;
  IF EXISTS (SELECT 1 FROM public.shopify_installations WHERE shop_domain = handoff.shop_domain
    AND merchant_id <> owner_merchant_id) THEN RAISE EXCEPTION 'shop_already_linked'; END IF;
  INSERT INTO public.shopify_installations (merchant_id, shop_domain, shop_id, shop_name, shop_email,
    status, access_token_ciphertext, granted_scopes, installed_at, metadata)
  VALUES (owner_merchant_id, handoff.shop_domain, (handoff.installation_data->>'shop_id')::bigint,
    handoff.installation_data->>'shop_name', NULL, 'active', handoff.installation_data->>'access_token_ciphertext',
    ARRAY(SELECT jsonb_array_elements_text(handoff.installation_data->'granted_scopes')), now(),
    COALESCE(handoff.installation_data->'metadata','{}'::jsonb))
  ON CONFLICT (merchant_id) DO UPDATE SET shop_domain = EXCLUDED.shop_domain, shop_id = EXCLUDED.shop_id,
    shop_name = EXCLUDED.shop_name, status = 'active', access_token_ciphertext = EXCLUDED.access_token_ciphertext,
    granted_scopes = EXCLUDED.granted_scopes, installed_at = now(), disconnected_at = NULL,
    uninstalled_at = NULL, oauth_state_hash = NULL, last_error = NULL, updated_at = now(),
    metadata = public.shopify_installations.metadata || EXCLUDED.metadata
  RETURNING id INTO result_id;
  UPDATE public.shopify_oauth_handoffs SET status = 'claimed', installation_data = NULL,
    merchant_id = owner_merchant_id WHERE id = handoff_id;
  RETURN result_id;
END $$;
REVOKE ALL ON FUNCTION public.claim_shopify_oauth_handoff(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_shopify_oauth_handoff(uuid,text,uuid) TO service_role;

-- Run through the application's authenticated scheduled maintenance endpoint.
CREATE OR REPLACE FUNCTION public.purge_expired_shopify_handoffs() RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  DELETE FROM public.shopify_oauth_handoffs WHERE expires_at < now() OR status = 'claimed';
$$;
REVOKE ALL ON FUNCTION public.purge_expired_shopify_handoffs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_shopify_handoffs() TO service_role;

COMMIT;
