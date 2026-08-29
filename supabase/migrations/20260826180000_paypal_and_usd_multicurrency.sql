-- Migration: 20260826180000_paypal_and_usd_multicurrency.sql
-- Description: Integration complete de la base de donnees PostgreSQL pour PayPal et Multi-devises USD

-- 0. Ajouter la colonne settings_json sur la table SETTINGS si elle n'existe pas encore
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS settings_json JSONB DEFAULT '{}'::JSONB;

-- 1. Colonnes PayPal & Compte USD sur la table MERCHANTS
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS paypal_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_usd_account BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS available_balance_usd NUMERIC(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS available_balance_usd_test NUMERIC(15,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS pending_balance_usd NUMERIC(15,2) DEFAULT 0.00;

-- Index pour optimiser les filtres d'eligibilite
CREATE INDEX IF NOT EXISTS idx_merchants_paypal_enabled ON public.merchants(paypal_enabled);
CREATE INDEX IF NOT EXISTS idx_merchants_has_usd_account ON public.merchants(has_usd_account);

-- 2. Colonnes de suivi des ordres PayPal & USD sur la table PAYMENTS
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS fee_amount_usd NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS net_amount_usd NUMERIC(15,2);

CREATE INDEX IF NOT EXISTS idx_payments_paypal_order_id ON public.payments(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paypal_capture_id ON public.payments(paypal_capture_id);

-- 3. Colonnes USD sur la table WITHDRAWALS (Retraits PayPal & Zelle)
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS fee_amount_usd NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS net_amount_usd NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS payout_destination_email TEXT;

-- 4. Initialisation/Mise a jour de system_settings pour PayPal global
INSERT INTO public.system_settings (key, value)
VALUES (
  'payment_provider_config',
  jsonb_build_object(
    'active_provider', 'bazik',
    'sms_gateway_enabled', true,
    'paym_moncash_web', true,
    'paym_moncash_ussd', false,
    'paym_natcash_web', true,
    'paym_natcash_ussd', false,
    'paypal_global_enabled', false
  )
)
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(
  public.system_settings.value,
  '{paypal_global_enabled}',
  COALESCE(public.system_settings.value->'paypal_global_enabled', 'false'::jsonb),
  true
),
updated_at = NOW();

-- 5. Trigger Postgres mis a jour pour gerer les deux devises (HTG et USD)
CREATE OR REPLACE FUNCTION handle_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'succeeded' AND NEW.status = 'succeeded' THEN
    -- Verifier la devise ou si c'est un paiement USD
    IF NEW.currency = 'USD' OR NEW.net_amount_usd IS NOT NULL THEN
      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET 
          available_balance_usd_test = COALESCE(available_balance_usd_test, 0) + COALESCE(NEW.net_amount_usd, NEW.net_amount, 0),
          updated_at = NOW()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET 
          available_balance_usd = COALESCE(available_balance_usd, 0) + COALESCE(NEW.net_amount_usd, NEW.net_amount, 0),
          updated_at = NOW()
        WHERE id = NEW.merchant_id;
      END IF;
    ELSE
      -- Paiements HTG standards (MonCash, NatCash)
      IF NEW.environment = 'test' THEN
        UPDATE public.merchants
        SET 
          available_balance_test = COALESCE(available_balance_test, 0) + COALESCE(NEW.net_amount, NEW.amount, 0),
          updated_at = NOW()
        WHERE id = NEW.merchant_id;
      ELSE
        UPDATE public.merchants
        SET 
          available_balance = COALESCE(available_balance, 0) + COALESCE(NEW.net_amount, NEW.amount, 0),
          updated_at = NOW()
        WHERE id = NEW.merchant_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est attache
DROP TRIGGER IF EXISTS on_payment_success ON public.payments;
CREATE TRIGGER on_payment_success
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_success();