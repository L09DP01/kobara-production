import { createAdminClient } from '@/utils/supabase/admin';
import { requireAdmin } from '@/lib/auth/require-admin';
import AdministratorsClient, { type Administrator } from './administrators-client';

export default async function AdministratorsPage() {
  const current = await requireAdmin(['super_admin']);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('super_admins')
    .select('id, email, name, role, is_active, last_login_at, created_at')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Impossible de charger les administrateurs: ${error.message}`);

  return (
    <AdministratorsClient
      initialAdministrators={(data || []) as Administrator[]}
      currentAdministratorId={current.user.id}
    />
  );
}
