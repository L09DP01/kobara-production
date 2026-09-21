/* eslint-disable @typescript-eslint/no-explicit-any -- NextAuth custom claims and statement rows are runtime augmented. */
import { auth } from '@/auth';
import { simplePdf } from '@/lib/server/partners/reports';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET(request: Request) {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const type = new URL(request.url).searchParams.get('type');
  if (type !== 'developer' && type !== 'ambassador') {
    return new Response('Invalid partner type', { status: 400 });
  }

  const supabase = createAdminClient();
  const table = type === 'developer' ? 'developer_accounts' : 'ambassador_accounts';
  const { data: account } = await supabase
    .from(table)
    .select('id,status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!account || account.status !== 'active') {
    return new Response('Forbidden', { status: 403 });
  }

  const { data: statements } = await supabase
    .from('partner_monthly_statements')
    .select('*')
    .eq('beneficiary_type', type)
    .eq('beneficiary_id', account.id)
    .order('statement_month', { ascending: false });

  const lines = [
    'KOBARA - RELEVES PARTENAIRE',
    `Type: ${type}`,
    '',
    ...(statements || []).flatMap((statement: any) => [
      `${statement.statement_month} | ${statement.currency} | ${statement.status}`,
      `Gagne: ${statement.earned_amount} | Annule: ${statement.reversed_amount} | Retire: ${statement.withdrawn_amount} | Solde: ${statement.closing_balance}`,
      '',
    ]),
  ];

  return new Response(simplePdf(lines), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="kobara-${type}-statements.pdf"`,
    },
  });
}
