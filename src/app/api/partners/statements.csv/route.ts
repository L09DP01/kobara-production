/* eslint-disable @typescript-eslint/no-explicit-any -- Statement rows are runtime augmented. */
import { auth } from '@/auth';
import { csvEscape } from '@/lib/server/partners/reports';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) return new Response('Unauthorized', { status: 401 });

  const type = new URL(request.url).searchParams.get('type');
  if (type !== 'developer' && type !== 'ambassador') return new Response('Invalid partner type', { status: 400 });

  const supabase = createAdminClient();
  const table = type === 'developer' ? 'developer_accounts' : 'ambassador_accounts';
  const { data: account } = await supabase.from(table).select('id,status').eq('user_id', user.id).maybeSingle();
  if (!account || account.status !== 'active') return new Response('Forbidden', { status: 403 });

  const { data } = await supabase.from('partner_monthly_statements').select('*')
    .eq('beneficiary_type', type).eq('beneficiary_id', account.id)
    .order('statement_month', { ascending: false });
  const rows = [
    ['Mois', 'Devise', 'Gagné', 'Annulé', 'Retiré', 'Solde', 'Statut'],
    ...(data || []).map((item: any) => [item.statement_month, item.currency, item.earned_amount,
      item.reversed_amount, item.withdrawn_amount, item.closing_balance, item.status]),
  ];
  return new Response(rows.map(row => row.map(csvEscape).join(',')).join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="kobara-${type}-statements.csv"`,
    },
  });
}
