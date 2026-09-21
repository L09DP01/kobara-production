-- Unify merchant team developers with Developer program accounts while keeping
-- merchant-initiated team access strictly outside the commission program.

ALTER TABLE public.merchant_members
  ADD COLUMN IF NOT EXISTS invite_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS developer_account_id UUID REFERENCES public.developer_accounts(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS merchant_members_invite_token_hash_idx
  ON public.merchant_members (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS merchant_members_developer_account_idx
  ON public.merchant_members (developer_account_id, merchant_id)
  WHERE developer_account_id IS NOT NULL;

ALTER TABLE public.developer_merchant_connections
  ADD COLUMN IF NOT EXISTS connection_source TEXT NOT NULL DEFAULT 'developer_referral',
  ADD COLUMN IF NOT EXISTS commission_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS merchant_member_id UUID REFERENCES public.merchant_members(id) ON DELETE SET NULL;

ALTER TABLE public.developer_merchant_connections
  DROP CONSTRAINT IF EXISTS developer_merchant_connections_connection_source_check;
ALTER TABLE public.developer_merchant_connections
  ADD CONSTRAINT developer_merchant_connections_connection_source_check
  CHECK (connection_source IN ('developer_referral', 'merchant_invitation'));

ALTER TABLE public.developer_merchant_connections
  DROP CONSTRAINT IF EXISTS developer_merchant_connections_merchant_id_key;
ALTER TABLE public.developer_merchant_connections
  DROP CONSTRAINT IF EXISTS developer_merchant_connections_developer_id_merchant_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS developer_connections_active_developer_merchant_idx
  ON public.developer_merchant_connections (developer_id, merchant_id)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS developer_connections_merchant_member_idx
  ON public.developer_merchant_connections (merchant_member_id)
  WHERE merchant_member_id IS NOT NULL;

-- Link legacy team rows to an existing Kobara user and Developer profile.
UPDATE public.merchant_members member
SET user_id = kobara_user.id,
    developer_account_id = developer.id,
    updated_at = NOW()
FROM public.users kobara_user
JOIN public.developer_accounts developer ON developer.user_id = kobara_user.id
WHERE member.role = 'developer'
  AND LOWER(member.email) = LOWER(kobara_user.email)
  AND (member.user_id IS NULL OR member.developer_account_id IS NULL);

-- Existing team memberships take precedence over a legacy duplicate access row.
UPDATE public.developer_merchant_connections connection
SET merchant_member_id = member.id,
    connection_source = 'merchant_invitation',
    commission_eligible = FALSE,
    updated_at = NOW()
FROM public.merchant_members member
JOIN public.developer_accounts developer ON developer.id = member.developer_account_id
WHERE connection.merchant_id = member.merchant_id
  AND connection.developer_id = developer.id
  AND member.role = 'developer'
  AND member.status = 'active';

CREATE OR REPLACE FUNCTION public.accept_merchant_developer_invitation(
  p_token_hash TEXT,
  p_user_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_member public.merchant_members%ROWTYPE;
  v_user public.users%ROWTYPE;
  v_developer public.developer_accounts%ROWTYPE;
  v_connection_id UUID;
BEGIN
  SELECT * INTO v_member
  FROM public.merchant_members
  WHERE invite_token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_member.role <> 'developer' OR v_member.status <> 'pending'
     OR v_member.invite_expires_at IS NULL OR v_member.invite_expires_at <= NOW() THEN
    RAISE EXCEPTION 'team_developer_invitation_invalid_or_expired' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND OR LOWER(v_user.email) <> LOWER(v_member.email) THEN
    RAISE EXCEPTION 'team_developer_invitation_email_or_role_mismatch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_developer FROM public.developer_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team_developer_account_missing' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.developer_merchant_connections (
    developer_id, merchant_id, status, connection_source, commission_eligible,
    merchant_member_id, withdrawal_access
  ) VALUES (
    v_developer.id, v_member.merchant_id, 'connected', 'merchant_invitation', FALSE,
    v_member.id, FALSE
  )
  ON CONFLICT (developer_id, merchant_id) WHERE status <> 'revoked'
  DO UPDATE SET
    merchant_member_id = EXCLUDED.merchant_member_id,
    connection_source = 'merchant_invitation',
    commission_eligible = FALSE,
    updated_at = NOW()
  RETURNING id INTO v_connection_id;

  UPDATE public.merchant_members
  SET user_id = p_user_id,
      developer_account_id = v_developer.id,
      status = 'active',
      accepted_at = NOW(),
      invite_token_hash = NULL,
      invite_expires_at = NULL,
      updated_at = NOW()
  WHERE id = v_member.id;

  INSERT INTO public.audit_logs (merchant_id, user_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_member.merchant_id, p_user_id, 'team.developer_invitation_accepted',
    'developer_merchant_connections', v_connection_id,
    jsonb_build_object(
      'developer_id', v_developer.id,
      'merchant_member_id', v_member.id,
      'connection_source', 'merchant_invitation',
      'commission_eligible', FALSE
    )
  );

  RETURN v_connection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_merchant_developer_invitation(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_merchant_developer_invitation(TEXT, UUID)
  TO service_role;

COMMENT ON COLUMN public.developer_merchant_connections.connection_source IS
  'developer_referral is acquired by the Developer program; merchant_invitation is delegated team access.';
COMMENT ON COLUMN public.developer_merchant_connections.commission_eligible IS
  'False for merchant-initiated team invitations; these connections never generate Developer rewards.';
