-- Migration: 20260819160000_kyc_fraud_detection.sql
-- Description: Antifraude KYC Didit (1 personne = 1 identité = 1 compte) avec suspension atomique et gestion des cas de fraude

-- 1. Table des empreintes d'identité documentaire (HMAC-SHA256)
CREATE TABLE IF NOT EXISTS public.kyc_identity_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    document_fingerprint TEXT NOT NULL,
    country_code VARCHAR(10) DEFAULT 'HT',
    document_type VARCHAR(50) DEFAULT 'ID',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'suspended', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_merchant_document_fingerprint UNIQUE(document_fingerprint, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_kyc_fingerprints_doc ON public.kyc_identity_fingerprints(document_fingerprint);
CREATE INDEX IF NOT EXISTS idx_kyc_fingerprints_merchant ON public.kyc_identity_fingerprints(merchant_id);

-- 2. Table des dossiers de fraude d'identité KYC
CREATE TABLE IF NOT EXISTS public.kyc_fraud_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_type TEXT NOT NULL CHECK (case_type IN ('duplicate_document', 'duplicate_face', 'duplicate_device', 'multi_signal', 'suspicious_document')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'confirmed_fraud', 'false_positive', 'resolved')),
    primary_merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE NOT NULL,
    related_merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
    primary_session_id TEXT,
    related_session_id TEXT,
    document_match BOOLEAN DEFAULT false,
    face_match BOOLEAN DEFAULT false,
    device_match BOOLEAN DEFAULT false,
    ip_match BOOLEAN DEFAULT false,
    risk_score INTEGER DEFAULT 0,
    reason_codes TEXT[] DEFAULT '{}',
    evidence JSONB DEFAULT '{}'::jsonb,
    action_taken TEXT DEFAULT 'none',
    reviewed_by UUID REFERENCES public.super_admins(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    resolution_note TEXT,
    ai_compliance_report JSONB DEFAULT NULL,
    ai_report_status TEXT DEFAULT 'pending' CHECK (ai_report_status IN ('pending', 'completed', 'failed', 'fallback', 'skipped')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_primary ON public.kyc_fraud_cases(primary_merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_related ON public.kyc_fraud_cases(related_merchant_id);
CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_status ON public.kyc_fraud_cases(status);
CREATE INDEX IF NOT EXISTS idx_kyc_fraud_cases_severity ON public.kyc_fraud_cases(severity);

-- 3. RLS
ALTER TABLE public.kyc_identity_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_fraud_cases ENABLE ROW LEVEL SECURITY;

-- Les marchands n'accèdent pas aux tables antifraude directement (gérées uniquement par le serveur / service_role / admins)
CREATE POLICY "Service role full access on kyc_identity_fingerprints" ON public.kyc_identity_fingerprints
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on kyc_fraud_cases" ON public.kyc_fraud_cases
    FOR ALL USING (auth.role() = 'service_role');

-- 4. RPC Atomique : Suspension conjointe de 2 comptes pour fraude d'identité critique
CREATE OR REPLACE FUNCTION public.suspend_duplicate_identity_accounts(
    p_merchant_id_a UUID,
    p_merchant_id_b UUID,
    p_fraud_case_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_locked_a public.merchants%ROWTYPE;
    v_locked_b public.merchants%ROWTYPE;
BEGIN
    -- Verrouiller les deux marchands pour garantir une mise à jour atomique sans race condition
    SELECT * INTO v_locked_a FROM public.merchants WHERE id = p_merchant_id_a FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'merchant_a_not_found';
    END IF;

    IF p_merchant_id_b IS NOT NULL AND p_merchant_id_b <> p_merchant_id_a THEN
        SELECT * INTO v_locked_b FROM public.merchants WHERE id = p_merchant_id_b FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'merchant_b_not_found';
        END IF;
    END IF;

    -- 1. Suspendre le Compte A
    UPDATE public.merchants
    SET account_access = 'suspended',
        kyc_status = 'suspended',
        updated_at = now()
    WHERE id = p_merchant_id_a;

    UPDATE public.kyc_profiles
    SET status = 'suspended',
        rejection_reason = 'Compte suspendu pour vérification de sécurité (identité dupliquée)',
        updated_at = now()
    WHERE merchant_id = p_merchant_id_a;

    INSERT INTO public.merchant_restrictions (merchant_id, restriction_type, reason)
    VALUES (p_merchant_id_a, 'duplicate_identity_suspension', p_reason);

    INSERT INTO public.risk_alerts (merchant_id, alert_type, severity, status, description)
    VALUES (p_merchant_id_a, 'kyc_duplicate_identity', 'critical', 'open', p_reason);

    INSERT INTO public.audit_logs (merchant_id, action, entity_type, entity_id, metadata)
    VALUES (
        p_merchant_id_a,
        'account.suspended_duplicate_identity',
        'fraud_case',
        p_fraud_case_id,
        jsonb_build_object(
            'related_merchant_id', p_merchant_id_b,
            'reason', p_reason,
            'timestamp', now()
        )
    );

    -- 2. Suspendre le Compte B (si distinct)
    IF p_merchant_id_b IS NOT NULL AND p_merchant_id_b <> p_merchant_id_a THEN
        UPDATE public.merchants
        SET account_access = 'suspended',
            kyc_status = 'suspended',
            updated_at = now()
        WHERE id = p_merchant_id_b;

        UPDATE public.kyc_profiles
        SET status = 'suspended',
            rejection_reason = 'Compte suspendu pour vérification de sécurité (identité dupliquée)',
            updated_at = now()
        WHERE merchant_id = p_merchant_id_b;

        INSERT INTO public.merchant_restrictions (merchant_id, restriction_type, reason)
        VALUES (p_merchant_id_b, 'duplicate_identity_suspension', p_reason);

        INSERT INTO public.risk_alerts (merchant_id, alert_type, severity, status, description)
        VALUES (p_merchant_id_b, 'kyc_duplicate_identity', 'critical', 'open', p_reason);

        INSERT INTO public.audit_logs (merchant_id, action, entity_type, entity_id, metadata)
        VALUES (
            p_merchant_id_b,
            'account.suspended_duplicate_identity',
            'fraud_case',
            p_fraud_case_id,
            jsonb_build_object(
                'primary_merchant_id', p_merchant_id_a,
                'reason', p_reason,
                'timestamp', now()
            )
        );
    END IF;

    -- 3. Mettre à jour le dossier de fraude
    UPDATE public.kyc_fraud_cases
    SET action_taken = 'suspended_both_accounts',
        status = 'open',
        updated_at = now()
    WHERE id = p_fraud_case_id;

    RETURN jsonb_build_object(
        'success', true,
        'suspended_merchants', ARRAY[p_merchant_id_a, p_merchant_id_b],
        'fraud_case_id', p_fraud_case_id
    );
END;
$$;

-- 5. RPC Administrative : Résolution et Réactivation sécurisée d'un cas de fraude
CREATE OR REPLACE FUNCTION public.resolve_kyc_fraud_case(
    p_fraud_case_id UUID,
    p_action TEXT, -- 'false_positive', 'confirm_fraud', 'reactivate_both', 'reactivate_primary', 'reactivate_related'
    p_admin_id UUID,
    p_resolution_note TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_case public.kyc_fraud_cases%ROWTYPE;
BEGIN
    SELECT * INTO v_case FROM public.kyc_fraud_cases WHERE id = p_fraud_case_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'fraud_case_not_found';
    END IF;

    IF p_action = 'false_positive' OR p_action = 'reactivate_both' THEN
        -- Réactiver les deux comptes
        UPDATE public.merchants
        SET account_access = 'live',
            kyc_status = 'approved',
            updated_at = now()
        WHERE id IN (v_case.primary_merchant_id, v_case.related_merchant_id);

        UPDATE public.kyc_profiles
        SET status = 'approved',
            updated_at = now()
        WHERE merchant_id IN (v_case.primary_merchant_id, v_case.related_merchant_id);

        UPDATE public.merchant_restrictions
        SET lifted_by = p_admin_id,
            lifted_at = now(),
            lift_reason = p_resolution_note
        WHERE merchant_id IN (v_case.primary_merchant_id, v_case.related_merchant_id)
          AND lifted_at IS NULL;

        UPDATE public.risk_alerts
        SET status = 'false_positive',
            resolved_by = p_admin_id,
            resolved_at = now(),
            resolution_note = p_resolution_note
        WHERE merchant_id IN (v_case.primary_merchant_id, v_case.related_merchant_id)
          AND status = 'open';

        UPDATE public.kyc_fraud_cases
        SET status = CASE WHEN p_action = 'false_positive' THEN 'false_positive' ELSE 'resolved' END,
            reviewed_by = p_admin_id,
            reviewed_at = now(),
            resolution_note = p_resolution_note,
            updated_at = now()
        WHERE id = p_fraud_case_id;

        INSERT INTO public.audit_logs (merchant_id, action, entity_type, entity_id, metadata)
        VALUES (
            v_case.primary_merchant_id,
            'account.reactivated_after_fraud_review',
            'fraud_case',
            p_fraud_case_id,
            jsonb_build_object('admin_id', p_admin_id, 'action', p_action, 'note', p_resolution_note)
        );

    ELSIF p_action = 'reactivate_primary' THEN
        UPDATE public.merchants SET account_access = 'live', kyc_status = 'approved', updated_at = now() WHERE id = v_case.primary_merchant_id;
        UPDATE public.kyc_profiles SET status = 'approved', updated_at = now() WHERE merchant_id = v_case.primary_merchant_id;
        UPDATE public.merchant_restrictions SET lifted_by = p_admin_id, lifted_at = now(), lift_reason = p_resolution_note WHERE merchant_id = v_case.primary_merchant_id AND lifted_at IS NULL;

        UPDATE public.kyc_fraud_cases SET status = 'resolved', reviewed_by = p_admin_id, reviewed_at = now(), resolution_note = p_resolution_note, updated_at = now() WHERE id = p_fraud_case_id;

    ELSIF p_action = 'reactivate_related' AND v_case.related_merchant_id IS NOT NULL THEN
        UPDATE public.merchants SET account_access = 'live', kyc_status = 'approved', updated_at = now() WHERE id = v_case.related_merchant_id;
        UPDATE public.kyc_profiles SET status = 'approved', updated_at = now() WHERE merchant_id = v_case.related_merchant_id;
        UPDATE public.merchant_restrictions SET lifted_by = p_admin_id, lifted_at = now(), lift_reason = p_resolution_note WHERE merchant_id = v_case.related_merchant_id AND lifted_at IS NULL;

        UPDATE public.kyc_fraud_cases SET status = 'resolved', reviewed_by = p_admin_id, reviewed_at = now(), resolution_note = p_resolution_note, updated_at = now() WHERE id = p_fraud_case_id;

    ELSIF p_action = 'confirm_fraud' THEN
        UPDATE public.kyc_fraud_cases
        SET status = 'confirmed_fraud',
            reviewed_by = p_admin_id,
            reviewed_at = now(),
            resolution_note = p_resolution_note,
            updated_at = now()
        WHERE id = p_fraud_case_id;

        UPDATE public.risk_alerts
        SET status = 'resolved',
            resolved_by = p_admin_id,
            resolved_at = now(),
            resolution_note = p_resolution_note
        WHERE merchant_id IN (v_case.primary_merchant_id, v_case.related_merchant_id)
          AND status = 'open';
    END IF;

    RETURN jsonb_build_object('success', true, 'action', p_action, 'fraud_case_id', p_fraud_case_id);
END;
$$;

-- Permissions d'exécution sécurisées
REVOKE ALL ON FUNCTION public.suspend_duplicate_identity_accounts(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suspend_duplicate_identity_accounts(UUID, UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.resolve_kyc_fraud_case(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_kyc_fraud_case(UUID, TEXT, UUID, TEXT) TO service_role;
