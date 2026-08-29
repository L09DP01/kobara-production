-- Prevent new merchants from sharing a business name, ignoring case and
-- repeated whitespace. Existing duplicates are intentionally grandfathered
-- so this migration does not rename active businesses without human review.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.normalize_business_name(p_name TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT lower(regexp_replace(btrim(COALESCE(p_name, '')), '[[:space:]]+', ' ', 'g'));
$$;

REVOKE ALL ON FUNCTION private.normalize_business_name(TEXT) FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_merchants_business_name_normalized
  ON public.merchants (private.normalize_business_name(business_name));

CREATE OR REPLACE FUNCTION private.enforce_unique_business_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_normalized_name TEXT;
BEGIN
  v_normalized_name := private.normalize_business_name(NEW.business_name);

  IF v_normalized_name = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'business_name_required',
      CONSTRAINT = 'merchants_business_name_required';
  END IF;

  -- Updating another profile field on a grandfathered duplicate remains valid.
  IF TG_OP = 'UPDATE'
     AND v_normalized_name = private.normalize_business_name(OLD.business_name) THEN
    NEW.business_name := regexp_replace(btrim(NEW.business_name), '[[:space:]]+', ' ', 'g');
    RETURN NEW;
  END IF;

  -- Serialize competing writes for the same normalized name.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_normalized_name, 0));

  IF EXISTS (
    SELECT 1
    FROM public.merchants AS merchant
    WHERE private.normalize_business_name(merchant.business_name) = v_normalized_name
      AND merchant.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'business_name_already_exists',
      DETAIL = 'Another merchant account already uses this normalized business name.',
      CONSTRAINT = 'merchants_business_name_normalized_key';
  END IF;

  NEW.business_name := regexp_replace(btrim(NEW.business_name), '[[:space:]]+', ' ', 'g');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.enforce_unique_business_name() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_unique_business_name ON public.merchants;
CREATE TRIGGER enforce_unique_business_name
BEFORE INSERT OR UPDATE OF business_name ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION private.enforce_unique_business_name();
