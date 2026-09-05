-- Represent every B2B movement in the canonical payment and withdrawal
-- histories. The balance movement and all three ledger rows are committed by
-- one PostgreSQL transaction, so a transfer can never be partially recorded.

ALTER TABLE public.b2b_transfers
  ADD COLUMN IF NOT EXISTS withdrawal_id UUID REFERENCES public.withdrawals(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_transfers_withdrawal_id
  ON public.b2b_transfers(withdrawal_id)
  WHERE withdrawal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_b2b_transfers_payment_id
  ON public.b2b_transfers(payment_id)
  WHERE payment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.process_b2b_transfer_v3(
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
  v_withdrawal_id UUID;
  v_payment_id UUID;
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

  INSERT INTO public.withdrawals (
    merchant_id,
    kobara_reference,
    amount,
    fees,
    total,
    wallet,
    customer_first_name,
    customer_last_name,
    customer_email,
    description,
    status,
    provider,
    environment,
    idempotency_key,
    currency,
    payout_currency,
    exchange_rate,
    payout_amount,
    balance_reserved_at,
    provider_response,
    completed_at,
    created_at,
    updated_at
  ) VALUES (
    p_sender_id,
    v_reference,
    p_amount,
    0,
    p_amount,
    v_receiver.email,
    v_receiver.business_name,
    NULL,
    v_receiver.email,
    'Transfert B2B vers ' || v_receiver.business_name,
    'completed',
    'b2b',
    v_environment,
    'b2b:' || v_transfer_id::TEXT,
    'HTG',
    'HTG',
    1,
    p_amount,
    NULL,
    jsonb_build_object(
      'internal_transfer', true,
      'b2b_transfer_id', v_transfer_id,
      'receiver_id', v_receiver_id,
      'receiver_email', v_receiver.email,
      'balance_debited_atomically', true
    ),
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_withdrawal_id;

  -- Insert directly as succeeded. The payment balance trigger runs only on a
  -- status transition, so this history row does not credit the receiver twice.
  INSERT INTO public.payments (
    merchant_id,
    kobara_reference,
    amount,
    fee_amount,
    net_amount,
    currency,
    status,
    provider,
    payment_method,
    payment_source,
    environment,
    metadata,
    paid_at,
    created_at,
    updated_at
  ) VALUES (
    v_receiver_id,
    v_reference,
    p_amount,
    0,
    p_amount,
    'HTG',
    'succeeded',
    'b2b',
    'b2b',
    'b2b',
    v_environment,
    jsonb_build_object(
      'internal_transfer', true,
      'b2b_transfer_id', v_transfer_id,
      'sender_id', p_sender_id,
      'sender_business_name', v_sender.business_name,
      'sender_email', v_sender.email,
      'balance_credited_atomically', true
    ),
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_payment_id;

  UPDATE public.b2b_transfers
  SET reference = v_reference,
      withdrawal_id = v_withdrawal_id,
      payment_id = v_payment_id
  WHERE id = v_transfer_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'b2b_ledger_link_failed';
  END IF;

  RETURN json_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'withdrawal_id', v_withdrawal_id,
    'payment_id', v_payment_id,
    'receiver_id', v_receiver_id,
    'receiver_email', v_receiver.email,
    'receiver_business_name', v_receiver.business_name,
    'reference', v_reference,
    'sender_balance_after', v_sender_balance_after,
    'receiver_balance_after', v_receiver_balance_after
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'process_b2b_transfer_v3 ledger transaction failed: %', SQLERRM;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_b2b_transfer_v3(UUID, VARCHAR, NUMERIC, VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer_v3(UUID, VARCHAR, NUMERIC, VARCHAR)
  TO service_role;

-- Existing server/mobile deployments call v2. Route them through the complete
-- ledger transaction after this migration is installed.
CREATE OR REPLACE FUNCTION public.process_b2b_transfer_v2(
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
  SELECT public.process_b2b_transfer_v3(
    p_sender_id,
    p_receiver_email,
    p_amount,
    p_environment
  );
$$;

REVOKE ALL ON FUNCTION public.process_b2b_transfer_v2(UUID, VARCHAR, NUMERIC, VARCHAR)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_b2b_transfer_v2(UUID, VARCHAR, NUMERIC, VARCHAR)
  TO service_role;

-- Backfill history only for transfers produced by the hardened function. Older
-- rows do not contain verified post-transfer balances and must be reconciled
-- manually before they can safely be presented as successful payments.
DO $$
DECLARE
  v_transfer RECORD;
  v_reference TEXT;
  v_withdrawal_id UUID;
  v_payment_id UUID;
BEGIN
  FOR v_transfer IN
    SELECT
      b.id,
      b.sender_id,
      b.receiver_id,
      b.amount,
      b.environment,
      b.created_at,
      b.withdrawal_id,
      b.payment_id,
      sender.business_name AS sender_business_name,
      sender.email AS sender_email,
      receiver.business_name AS receiver_business_name,
      receiver.email AS receiver_email
    FROM public.b2b_transfers b
    JOIN public.merchants sender ON sender.id = b.sender_id
    JOIN public.merchants receiver ON receiver.id = b.receiver_id
    WHERE b.status = 'completed'
      AND b.sender_balance_after IS NOT NULL
      AND b.receiver_balance_after IS NOT NULL
      AND (b.withdrawal_id IS NULL OR b.payment_id IS NULL)
    ORDER BY b.created_at ASC
  LOOP
    v_reference := 'B2B' || UPPER(REPLACE(v_transfer.id::TEXT, '-', ''));
    v_withdrawal_id := v_transfer.withdrawal_id;
    v_payment_id := v_transfer.payment_id;

    IF v_withdrawal_id IS NULL THEN
      SELECT id INTO v_withdrawal_id
      FROM public.withdrawals
      WHERE merchant_id = v_transfer.sender_id
        AND kobara_reference = v_reference
      LIMIT 1;

      IF v_withdrawal_id IS NULL THEN
        INSERT INTO public.withdrawals (
          merchant_id, kobara_reference, amount, fees, total, wallet,
          customer_first_name, customer_email, description, status, provider,
          environment, idempotency_key, currency, payout_currency,
          exchange_rate, payout_amount, balance_reserved_at, provider_response,
          completed_at, created_at, updated_at
        ) VALUES (
          v_transfer.sender_id, v_reference, v_transfer.amount, 0,
          v_transfer.amount, v_transfer.receiver_email,
          v_transfer.receiver_business_name, v_transfer.receiver_email,
          'Transfert B2B vers ' || v_transfer.receiver_business_name,
          'completed', 'b2b', v_transfer.environment,
          'b2b:' || v_transfer.id::TEXT, 'HTG', 'HTG', 1,
          v_transfer.amount, NULL,
          jsonb_build_object(
            'internal_transfer', true,
            'b2b_transfer_id', v_transfer.id,
            'receiver_id', v_transfer.receiver_id,
            'receiver_email', v_transfer.receiver_email,
            'historical_backfill', true
          ),
          v_transfer.created_at, v_transfer.created_at, v_transfer.created_at
        ) RETURNING id INTO v_withdrawal_id;
      END IF;
    END IF;

    IF v_payment_id IS NULL THEN
      SELECT id INTO v_payment_id
      FROM public.payments
      WHERE merchant_id = v_transfer.receiver_id
        AND kobara_reference = v_reference
      LIMIT 1;

      IF v_payment_id IS NULL THEN
        INSERT INTO public.payments (
          merchant_id, kobara_reference, amount, fee_amount, net_amount,
          currency, status, provider, payment_method, payment_source,
          environment, metadata, paid_at, created_at, updated_at
        ) VALUES (
          v_transfer.receiver_id, v_reference, v_transfer.amount, 0,
          v_transfer.amount, 'HTG', 'succeeded', 'b2b', 'b2b', 'b2b',
          v_transfer.environment,
          jsonb_build_object(
            'internal_transfer', true,
            'b2b_transfer_id', v_transfer.id,
            'sender_id', v_transfer.sender_id,
            'sender_business_name', v_transfer.sender_business_name,
            'sender_email', v_transfer.sender_email,
            'historical_backfill', true
          ),
          v_transfer.created_at, v_transfer.created_at, v_transfer.created_at
        ) RETURNING id INTO v_payment_id;
      END IF;
    END IF;

    UPDATE public.b2b_transfers
    SET reference = v_reference,
        withdrawal_id = v_withdrawal_id,
        payment_id = v_payment_id
    WHERE id = v_transfer.id;
  END LOOP;
END;
$$;
