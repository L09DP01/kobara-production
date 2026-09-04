-- A B2B transfer is complete only when both merchant balances have been
-- updated in the same transaction. Persist the resulting balances so support
-- can audit the accounting result without reconstructing concurrent activity.

ALTER TABLE public.b2b_transfers
  ADD COLUMN IF NOT EXISTS sender_balance_after NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS receiver_balance_after NUMERIC(15,2);

ALTER TABLE public.b2b_transfers
  DROP CONSTRAINT IF EXISTS b2b_transfers_positive_amount;
ALTER TABLE public.b2b_transfers
  ADD CONSTRAINT b2b_transfers_positive_amount
  CHECK (amount > 0) NOT VALID;
ALTER TABLE public.b2b_transfers
  VALIDATE CONSTRAINT b2b_transfers_positive_amount;

CREATE OR REPLACE FUNCTION public.process_b2b_transfer_v2(
  p_sender_id UUID,
  p_receiver_email VARCHAR,
  p_amount NUMERIC,
  p_environment VARCHAR
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_environment TEXT;
  v_receiver_id UUID;
  v_sender public.merchants%ROWTYPE;
  v_receiver public.merchants%ROWTYPE;
  v_sender_balance_before NUMERIC(15,2);
  v_receiver_balance_before NUMERIC(15,2);
  v_sender_balance_after NUMERIC(15,2);
  v_receiver_balance_after NUMERIC(15,2);
  v_transfer_id UUID;
  v_reference VARCHAR;
  v_funds JSONB;
BEGIN
  v_environment := LOWER(BTRIM(COALESCE(p_environment, '')));

  IF v_environment NOT IN ('live', 'test') THEN
    RETURN json_build_object('success', false, 'error', 'Environnement invalide.', 'code', 'INVALID_ENVIRONMENT');
  END IF;

  IF COALESCE(p_amount, 0) < 1 OR p_amount <> ROUND(p_amount, 2) THEN
    RETURN json_build_object('success', false, 'error', 'Le montant doit être d''au moins 1 HTG et comporter au maximum deux décimales.', 'code', 'INVALID_AMOUNT');
  END IF;

  SELECT * INTO v_sender
  FROM public.merchants
  WHERE id = p_sender_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Marchand expéditeur introuvable.', 'code', 'SENDER_NOT_FOUND');
  END IF;

  SELECT * INTO v_receiver
  FROM public.merchants
  WHERE LOWER(email) = LOWER(BTRIM(p_receiver_email))
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Le marchand destinataire n''existe pas.', 'code', 'RECEIVER_NOT_FOUND');
  END IF;

  v_receiver_id := v_receiver.id;
  IF v_receiver_id = p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Vous ne pouvez pas vous transférer de l''argent à vous-même.', 'code', 'SELF_TRANSFER');
  END IF;

  IF v_sender.status IS DISTINCT FROM 'active'
     OR COALESCE(v_sender.kyc_status, '') NOT IN ('approved', 'verified') THEN
    RETURN json_build_object('success', false, 'error', 'Le compte expéditeur n''est pas autorisé à effectuer ce transfert.', 'code', 'SENDER_NOT_ELIGIBLE');
  END IF;

  IF v_receiver.status IS DISTINCT FROM 'active'
     OR COALESCE(v_receiver.kyc_status, '') NOT IN ('approved', 'verified') THEN
    RETURN json_build_object('success', false, 'error', 'Le compte destinataire n''est pas vérifié ou est inactif.', 'code', 'RECEIVER_NOT_ELIGIBLE');
  END IF;

  -- Lock in a stable order to prevent two opposite transfers from deadlocking.
  PERFORM id
  FROM public.merchants
  WHERE id IN (p_sender_id, v_receiver_id)
  ORDER BY id
  FOR UPDATE;

  SELECT * INTO STRICT v_sender FROM public.merchants WHERE id = p_sender_id;
  SELECT * INTO STRICT v_receiver FROM public.merchants WHERE id = v_receiver_id;

  IF v_environment = 'test' THEN
    v_sender_balance_before := COALESCE(v_sender.available_balance_test, 0);
    v_receiver_balance_before := COALESCE(v_receiver.available_balance_test, 0);
  ELSE
    v_sender_balance_before := COALESCE(v_sender.available_balance, 0);
    v_receiver_balance_before := COALESCE(v_receiver.available_balance, 0);
  END IF;

  v_funds := public.get_merchant_funds_availability(p_sender_id, v_environment, 'HTG');
  IF COALESCE((v_funds->>'withdrawable_balance')::NUMERIC, 0) < p_amount THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Le solde disponible au retrait est insuffisant.',
      'code', 'FUNDS_PENDING_RELEASE',
      'withdrawable_balance', COALESCE((v_funds->>'withdrawable_balance')::NUMERIC, 0)
    );
  END IF;

  IF v_sender_balance_before < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Solde insuffisant pour ce transfert.', 'code', 'INSUFFICIENT_BALANCE');
  END IF;

  IF v_environment = 'test' THEN
    UPDATE public.merchants
    SET available_balance_test = COALESCE(available_balance_test, 0) - p_amount,
        updated_at = NOW()
    WHERE id = p_sender_id
    RETURNING available_balance_test INTO v_sender_balance_after;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'b2b_sender_debit_failed';
    END IF;

    UPDATE public.merchants
    SET available_balance_test = COALESCE(available_balance_test, 0) + p_amount,
        updated_at = NOW()
    WHERE id = v_receiver_id
    RETURNING available_balance_test INTO v_receiver_balance_after;
  ELSE
    UPDATE public.merchants
    SET available_balance = COALESCE(available_balance, 0) - p_amount,
        updated_at = NOW()
    WHERE id = p_sender_id
    RETURNING available_balance INTO v_sender_balance_after;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'b2b_sender_debit_failed';
    END IF;

    UPDATE public.merchants
    SET available_balance = COALESCE(available_balance, 0) + p_amount,
        updated_at = NOW()
    WHERE id = v_receiver_id
    RETURNING available_balance INTO v_receiver_balance_after;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'b2b_receiver_credit_failed';
  END IF;

  IF v_sender_balance_after <> v_sender_balance_before - p_amount
     OR v_receiver_balance_after <> v_receiver_balance_before + p_amount THEN
    RAISE EXCEPTION 'b2b_balance_invariant_failed';
  END IF;

  INSERT INTO public.b2b_transfers (
    sender_id,
    receiver_id,
    amount,
    environment,
    status,
    sender_balance_after,
    receiver_balance_after
  ) VALUES (
    p_sender_id,
    v_receiver_id,
    p_amount,
    v_environment,
    'completed',
    v_sender_balance_after,
    v_receiver_balance_after
  )
  RETURNING id INTO v_transfer_id;

  v_reference := 'B2B' || UPPER(REPLACE(v_transfer_id::TEXT, '-', ''));
  UPDATE public.b2b_transfers
  SET reference = v_reference
  WHERE id = v_transfer_id;

  RETURN json_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'receiver_id', v_receiver_id,
    'receiver_email', v_receiver.email,
    'receiver_business_name', v_receiver.business_name,
    'reference', v_reference,
    'sender_balance_after', v_sender_balance_after,
    'receiver_balance_after', v_receiver_balance_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'process_b2b_transfer_v2 failed: %', SQLERRM;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_b2b_transfer_v2(UUID, VARCHAR, NUMERIC, VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer_v2(UUID, VARCHAR, NUMERIC, VARCHAR)
  TO service_role;

-- Keep existing dashboard/mobile deployments compatible while the application
-- switches to the versioned RPC. Calling v2 prevents an old implementation
-- from moving money before the accounting checks are available.
CREATE OR REPLACE FUNCTION public.process_b2b_transfer(
  p_sender_id UUID,
  p_receiver_email VARCHAR,
  p_amount NUMERIC,
  p_environment VARCHAR
)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.process_b2b_transfer_v2(
    p_sender_id,
    p_receiver_email,
    p_amount,
    p_environment
  );
$$;

REVOKE ALL ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer(UUID, VARCHAR, NUMERIC, VARCHAR)
  TO service_role;
