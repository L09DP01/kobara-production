-- Fonction pour mettre à jour automatiquement le solde disponible du marchand
CREATE OR REPLACE FUNCTION handle_payment_success()
RETURNS TRIGGER AS $$
BEGIN
  -- Si le statut passe à 'succeeded'
  IF OLD.status != 'succeeded' AND NEW.status = 'succeeded' THEN
    IF NEW.environment = 'test' THEN
      UPDATE public.merchants
      SET 
        available_balance_test = available_balance_test + NEW.net_amount,
        updated_at = NOW()
      WHERE id = NEW.merchant_id;
    ELSE
      UPDATE public.merchants
      SET 
        available_balance = available_balance + NEW.net_amount,
        updated_at = NOW()
      WHERE id = NEW.merchant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà (pour éviter les doublons lors des resets)
DROP TRIGGER IF EXISTS on_payment_success ON public.payments;

-- Créer le trigger sur la table payments
CREATE TRIGGER on_payment_success
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION handle_payment_success();
