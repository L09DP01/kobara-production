/* eslint-disable @typescript-eslint/no-explicit-any -- NextAuth custom claims and statement rows are runtime augmented. */
import { auth } from '@/auth';
import { simplePdf } from '@/lib/server/partners/reports';
import { createAdminClient } from '@/utils/supabase/admin';

export async function GET() {
  const session = await auth();
  const user = session?.user as any;
  if (!user?.id || !['developer', 'ambassador'].includes(user.role)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const table = user.role === 'developer' ? 'developer_accounts' : 'ambassador_accounts';
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
    .eq('beneficiary_type', user.role)
    .eq('beneficiary_id', account.id)
    .order('statement_month', { ascending: false });

  const lines = [
    'KOBARA - RELEVES PARTENAIRE',
    `Type: ${user.role}`,
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
      'content-disposition': 'attachment; filename="kobara-statements.pdf"',
    },
  });
}
