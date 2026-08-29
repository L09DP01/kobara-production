-- Keep the persisted provider configuration aligned with the supported routing matrix.
UPDATE public.system_settings
SET
  value = jsonb_set(
    jsonb_set(
      value,
      '{paym_natcash_ussd}',
      'false'::jsonb,
      true
    ),
    '{sms_gateway_enabled}',
    to_jsonb(CASE
      WHEN value->>'active_provider' = 'bazik'
        THEN COALESCE((value->>'sms_gateway_enabled')::boolean, true)
      ELSE false
    END),
    true
  ),
  updated_at = NOW()
WHERE key = 'payment_provider_config';
