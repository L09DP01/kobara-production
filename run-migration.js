const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    await client.query(`
      -- Table pour l'historique des transferts B2B
      CREATE TABLE IF NOT EXISTS public.b2b_transfers (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          sender_id UUID REFERENCES public.merchants(id) NOT NULL,
          receiver_id UUID REFERENCES public.merchants(id) NOT NULL,
          amount DECIMAL(15, 2) NOT NULL,
          environment VARCHAR(20) DEFAULT 'test' CHECK (environment IN ('test', 'live')),
          status VARCHAR(50) DEFAULT 'completed',
          reference VARCHAR(100),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Policies (lecture seule pour les marchands concernés)
      ALTER TABLE public.b2b_transfers ENABLE ROW LEVEL SECURITY;
      
      DROP POLICY IF EXISTS "Users can view their sent b2b transfers" ON public.b2b_transfers;
      CREATE POLICY "Users can view their sent b2b transfers" ON public.b2b_transfers FOR SELECT USING (sender_id = get_current_merchant_id());
      
      DROP POLICY IF EXISTS "Users can view their received b2b transfers" ON public.b2b_transfers;
      CREATE POLICY "Users can view their received b2b transfers" ON public.b2b_transfers FOR SELECT USING (receiver_id = get_current_merchant_id());

      -- Fonction sécurisée pour exécuter le transfert de manière transactionnelle
      CREATE OR REPLACE FUNCTION process_b2b_transfer(
        p_sender_id UUID,
        p_receiver_email VARCHAR,
        p_amount DECIMAL,
        p_environment VARCHAR
      ) RETURNS json AS $$
      DECLARE
        v_receiver_id UUID;
        v_sender_balance DECIMAL;
        v_transfer_id UUID;
        v_reference VARCHAR;
      BEGIN
        -- 1. Trouver le receiver
        SELECT id INTO v_receiver_id 
        FROM public.merchants 
        WHERE email = p_receiver_email;

        IF v_receiver_id IS NULL THEN
          RETURN json_build_object('success', false, 'error', 'Le marchand destinataire n''existe pas.');
        END IF;

        IF v_receiver_id = p_sender_id THEN
          RETURN json_build_object('success', false, 'error', 'Vous ne pouvez pas vous transférer de l''argent à vous-même.');
        END IF;

        -- 2. Vérifier le solde de l'expéditeur et verrouiller la ligne
        IF p_environment = 'test' THEN
          SELECT available_balance_test INTO v_sender_balance
          FROM public.merchants
          WHERE id = p_sender_id
          FOR UPDATE;
        ELSE
          SELECT available_balance INTO v_sender_balance
          FROM public.merchants
          WHERE id = p_sender_id
          FOR UPDATE;
        END IF;

        IF v_sender_balance < p_amount THEN
          RETURN json_build_object('success', false, 'error', 'Fonds insuffisants.');
        END IF;

        -- 3. Verrouiller la ligne du destinataire
        PERFORM id FROM public.merchants WHERE id = v_receiver_id FOR UPDATE;

        -- 4. Déduire l'argent
        IF p_environment = 'test' THEN
          UPDATE public.merchants SET available_balance_test = available_balance_test - p_amount WHERE id = p_sender_id;
          UPDATE public.merchants SET available_balance_test = available_balance_test + p_amount WHERE id = v_receiver_id;
        ELSE
          UPDATE public.merchants SET available_balance = available_balance - p_amount WHERE id = p_sender_id;
          UPDATE public.merchants SET available_balance = available_balance + p_amount WHERE id = v_receiver_id;
        END IF;

        -- 5. Enregistrer le transfert
        v_reference := 'B2B-' || EXTRACT(EPOCH FROM NOW())::BIGINT;
        
        INSERT INTO public.b2b_transfers (sender_id, receiver_id, amount, environment, reference)
        VALUES (p_sender_id, v_receiver_id, p_amount, p_environment, v_reference)
        RETURNING id INTO v_transfer_id;

        RETURN json_build_object(
          'success', true, 
          'transfer_id', v_transfer_id, 
          'receiver_id', v_receiver_id,
          'reference', v_reference
        );
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log('Migration successfully applied.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
