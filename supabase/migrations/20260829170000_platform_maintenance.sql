BEGIN;

INSERT INTO public.system_settings (key, value, updated_at, updated_by)
VALUES (
  'platform_maintenance',
  jsonb_build_object(
    'enabled', false,
    'announcement_enabled', true,
    'auto_start', true,
    'scheduled_for', '2026-08-30T21:00:00.000Z',
    'title', 'Maintenance programmée',
    'message', 'Une maintenance est prévue dimanche à 17 h. Les services Kobara seront temporairement indisponibles.',
    'maintenance_message', 'Les services Kobara sont temporairement suspendus pendant une intervention planifiée. Ils seront rétablis dès la fin des vérifications.',
    'updated_at', NOW()
  ),
  NOW(),
  'system'
)
ON CONFLICT (key) DO NOTHING;

COMMIT;
