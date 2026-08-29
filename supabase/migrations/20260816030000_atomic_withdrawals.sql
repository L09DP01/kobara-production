-- Migration: 20260816030000_atomic_withdrawals.sql
-- Description: RPCs atomiques et sécurisées pour la réservation, finalisation et remboursement idempotent des retraits

-- 1. Ajouter les colonnes manquantes pour le suivi et l'idempotence
ALTER TABLE public.withdrawals 
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS provider_response JSONB;

-- Index pour l'idempotence des retraits
CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_idempotency_key 
ON public.withdrawals (merchant_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawals_status_env 
ON public.withdrawals (merchant_id, status, environment);

-- 2. RPC: prepare_automatic_withdrawal
-- Verrouille le solde, vérifie les fonds, réserve/débite et crée le record withdrawal dans la même transaction
CREATE OR REPLACE FUNCTION public.prepare_automatic_withdrawal(
  p_merchant_id UUID,
  p_amount NUMERIC,
  p_fees NUMERIC,
  p_total NUMERIC,
  p_method TEXT,
  p_provider TEXT,
  p_wallet TEXT,
  p_reference TEXT,
  p_environment TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT 'Retrait Kobara'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_merchant public.merchants%ROWTYPE;
  v_balance NUMERIC;
  v_is_test BOOLEAN;
  v_existing public.withdrawals%ROWTYPE;
  v_inserted public.withdrawals%ROWTYPE;
  v_initial_status TEXT;
BEGIN
  -- Vérification d'idempotence si une clé est fournie
  IF p_idempotency_key IS NOT NULL AND BTRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing FROM public.withdrawals
    WHERE merchant_id = p_merchant_id AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'already_exists', true,
        'withdrawal', row_to_json(v_existing)
      );
    END IF;
  END IF;

  -- Verrouillage du merchant pour empêcher les courses critiques (Race Conditions)
  SELECT * INTO v_merchant FROM public.merchants
  WHERE id = p_merchant_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'merchant_not_found', 'message', 'Marchand introuvable.');
  END IF;

  v_is_test := p_environment = 'test';
  v_balance := CASE WHEN v_is_test THEN COALESCE(v_merchant.available_balance_test, 0) ELSE COALESCE(v_merchant.available_balance, 0) END;

  -- Vérification du solde (total brut = amount net + fees)
  IF p_total <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount', 'message', 'Montant invalide.');
  END IF;

  IF v_balance < p_total THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'message', 'Fonds insuffisants pour ce retrait.');
  END IF;

  -- Déterminer le statut initial selon la méthode
  IF LOWER(p_method) = 'zelle' THEN
    v_initial_status := 'pending_approval';
  ELSE
    v_initial_status := 'pending';
  END IF;

  -- Si retrait automatisé (non Zelle), déduire immédiatement le solde de manière atomique
  IF v_initial_status <> 'pending_approval' THEN
    IF v_is_test THEN
      UPDATE public.merchants
      SET available_balance_test = available_balance_test - p_total,
          updated_at = NOW()
      WHERE id = p_merchant_id;
    ELSE
      UPDATE public.merchants
      SET available_balance = available_balance - p_total,
          updated_at = NOW()
      WHERE id = p_merchant_id;
    END IF;
  END IF;

  -- Création de l'enregistrement de retrait
  INSERT INTO public.withdrawals (
    merchant_id,
    kobara_reference,
    amount,
    fees,
    total,
    wallet,
    description,
    status,
    provider,
    environment,
    idempotency_key,
    created_at,
    updated_at
  ) VALUES (
    p_merchant_id,
    p_reference,
    p_amount,
    p_fees,
    p_total,
    p_wallet,
    p_description,
    v_initial_status,
    LOWER(p_provider),
    p_environment,
    NULLIF(BTRIM(p_idempotency_key), ''),
    NOW(),
    NOW()
  ) RETURNING * INTO v_inserted;

  RETURN jsonb_build_object(
    'success', true,
    'already_exists', false,
    'withdrawal', row_to_json(v_inserted)
  );
END;
$$;

-- 3. RPC: complete_automatic_withdrawal
-- Finalise un retrait en marquant son statut 'completed'
CREATE OR REPLACE FUNCTION public.complete_automatic_withdrawal(
  p_withdrawal_id UUID,
  p_provider_transaction_id TEXT DEFAULT NULL,
  p_provider_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_updated public.withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_withdrawal FROM public.withdrawals
  WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'withdrawal_not_found');
  END IF;

  IF v_withdrawal.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true, 'withdrawal', row_to_json(v_withdrawal));
  END IF;

  IF v_withdrawal.status NOT IN ('pending', 'pending_approval') THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_state', 'current_status', v_withdrawal.status);
  END IF;

  UPDATE public.withdrawals
  SET status = 'completed',
      bazik_transaction_id = COALESCE(p_provider_transaction_id, bazik_transaction_id),
      provider_response = COALESCE(p_provider_response, provider_response),
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_withdrawal_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object('success', true, 'withdrawal', row_to_json(v_updated));
END;
$$;

-- 4. RPC: fail_and_refund_withdrawal
-- Remboursement atomique et strictement IDEMPOTENT d'un retrait échoué ou annulé
CREATE OR REPLACE FUNCTION public.fail_and_refund_withdrawal(
  p_withdrawal_id UUID,
  p_reason TEXT DEFAULT 'Transfer failed',
  p_provider_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_withdrawal public.withdrawals%ROWTYPE;
  v_merchant public.merchants%ROWTYPE;
  v_updated public.withdrawals%ROWTYPE;
  v_is_test BOOLEAN;
BEGIN
  SELECT * INTO v_withdrawal FROM public.withdrawals
  WHERE id = p_withdrawal_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'withdrawal_not_found');
  END IF;

  -- Protection IDEMPOTENCE : Si déjà marqué échoué/rejeté ou remboursé, NE PAS re-créditer
  IF v_withdrawal.status IN ('failed', 'rejected') OR v_withdrawal.refunded_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_refunded', true,
      'message', 'Withdrawal is already failed or refunded',
      'withdrawal', row_to_json(v_withdrawal)
    );
  END IF;

  -- Interdire le remboursement d'un retrait déjà complété ou payé
  IF v_withdrawal.status IN ('completed', 'paid') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_refund_completed_withdrawal',
      'current_status', v_withdrawal.status
    );
  END IF;

  v_is_test := v_withdrawal.environment = 'test';

  -- Si le retrait était en pending, le solde avait été déduit lors de prepare_automatic_withdrawal -> Restitution
  IF v_withdrawal.status = 'pending' THEN
    SELECT * INTO v_merchant FROM public.merchants
    WHERE id = v_withdrawal.merchant_id FOR UPDATE;

    IF v_is_test THEN
      UPDATE public.merchants
      SET available_balance_test = available_balance_test + v_withdrawal.total,
          updated_at = NOW()
      WHERE id = v_withdrawal.merchant_id;
    ELSE
      UPDATE public.merchants
      SET available_balance = available_balance + v_withdrawal.total,
          updated_at = NOW()
      WHERE id = v_withdrawal.merchant_id;
    END IF;
  END IF;

  -- Mettre à jour le statut du retrait
  UPDATE public.withdrawals
  SET status = 'failed',
      failed_reason = p_reason,
      refunded_at = NOW(),
      completed_at = NOW(),
      provider_response = COALESCE(p_provider_response, provider_response),
      updated_at = NOW()
  WHERE id = p_withdrawal_id
  RETURNING * INTO v_updated;

  RETURN jsonb_build_object(
    'success', true,
    'refunded', (v_withdrawal.status = 'pending'),
    'amount_refunded', CASE WHEN v_withdrawal.status = 'pending' THEN v_withdrawal.total ELSE 0 END,
    'withdrawal', row_to_json(v_updated)
  );
END;
$$;

-- Permissions de sécurité : restreindre aux services backend (service_role)
REVOKE ALL ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_automatic_withdrawal(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.complete_automatic_withdrawal(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_automatic_withdrawal(UUID, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.fail_and_refund_withdrawal(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_and_refund_withdrawal(UUID, TEXT, JSONB) TO service_role;
