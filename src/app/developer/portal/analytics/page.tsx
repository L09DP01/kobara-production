/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase ledger rows are runtime-shaped. */
import { MetricCard } from '@/components/partners/metric-card';
import { requirePartner } from '@/lib/server/partners/auth';

export default async function DeveloperAnalytics() {
  const { account, supabase } = await requirePartner('developer');
  const { data } = await supabase.from('partner_commission_ledger')
    .select('amount,currency,status,entry_type,created_at')
    .eq('developer_id', account.id).order('created_at', { ascending: false });
  const sum = (currency: string, status?: string) => (data || [])
    .filter((item: any) => item.currency === currency && (!status || item.status === status))
    .reduce((total: number, item: any) => total + Number(item.amount), 0);

  return <div>
    <h1 className="text-3xl font-black">Analyses</h1>
    <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Disponible USD" value={`${sum('USD', 'available').toFixed(2)} $`} />
      <MetricCard label="Disponible HTG" value={`${sum('HTG', 'available').toFixed(2)} HTG`} />
      <MetricCard label="Total USD" value={`${sum('USD').toFixed(2)} $`} />
      <MetricCard label="Total HTG" value={`${sum('HTG').toFixed(2)} HTG`} />
    </section>
    <div className="mt-7 flex flex-wrap gap-3">
      <a href="/api/partners/statements.csv?type=developer" className="rounded-md border border-slate-700 px-4 py-2 text-sm font-bold">Exporter CSV</a>
      <a href="/api/partners/statements.pdf?type=developer" className="rounded-md border border-slate-700 px-4 py-2 text-sm font-bold">Exporter PDF</a>
    </div>
  </div>;
}
