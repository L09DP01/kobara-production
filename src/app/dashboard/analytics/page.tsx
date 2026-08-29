import { getCurrentUserAndMerchant } from "@/utils/supabase/auth-helper";
import RevenueChart from "./RevenueChart";

export default async function AnalyticsPage() {
  const { merchant, supabase } = await getCurrentUserAndMerchant();
  const merchantId = merchant.id;

  // Get payments for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const { data: payments } = await supabase
    .from('payments')
    .select(`
      amount, 
      status, 
      created_at, 
      customer_id,
      customers (name, phone)
    `)
    .eq('merchant_id', merchantId)
    .eq('environment', merchant.current_environment || 'test')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  let totalGross = 0;
  let successCount = 0;
  let uniqueCustomers = new Set();
  
  const chartDataMap: Record<string, number> = {};
  const customerVolumes: Record<string, { id: string, name: string, phone: string, total: number }> = {};
  
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    chartDataMap[dateStr] = 0;
  }

  if (payments) {
    payments.forEach(p => {
      if (p.status === 'succeeded' || p.status === 'completed') {
        totalGross += Number(p.amount);
        successCount++;
        
        if (p.customer_id) {
          uniqueCustomers.add(p.customer_id);
          
          if (p.customers) {
            if (!customerVolumes[p.customer_id]) {
              // Ensure we handle arrays or single objects from PostgREST depending on schema relations
              const cust = Array.isArray(p.customers) ? p.customers[0] : p.customers;
              if (cust) {
                customerVolumes[p.customer_id] = {
                  id: p.customer_id,
                  name: cust.name || 'Client sans nom',
                  phone: cust.phone || '',
                  total: 0
                };
              }
            }
            if (customerVolumes[p.customer_id]) {
              customerVolumes[p.customer_id].total += Number(p.amount);
            }
          }
        }

        const pDate = new Date(p.created_at);
        const dateStr = pDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (chartDataMap[dateStr] !== undefined) {
          chartDataMap[dateStr] += Number(p.amount);
        }
      }
    });
  }

  const chartData = Object.keys(chartDataMap).map(date => ({
    date,
    revenue: chartDataMap[date]
  }));

  const conversionRate = payments && payments.length > 0 
    ? ((successCount / payments.length) * 100).toFixed(1) 
    : '0.0';

  const topClients = Object.values(customerVolumes)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const kpiCards = [
    { label: 'Revenus Bruts', value: `${totalGross.toLocaleString('fr-FR')} HTG`, icon: 'payments', color: 'green', bgColor: 'bg-green-500/20', textColor: 'text-green-400', borderColor: 'border-l-green-500' },
    { label: 'Paiements Réussis', value: successCount.toString(), icon: 'check_circle', color: 'blue', bgColor: 'bg-blue-500/20', textColor: 'text-blue-400', borderColor: 'border-l-blue-500' },
    { label: 'Taux de Conversion', value: `${conversionRate}%`, icon: 'query_stats', color: 'purple', bgColor: 'bg-purple-500/20', textColor: 'text-purple-400', borderColor: 'border-l-purple-500' },
    { label: 'Clients Uniques', value: uniqueCustomers.size.toString(), icon: 'group_add', color: 'orange', bgColor: 'bg-orange-500/20', textColor: 'text-orange-400', borderColor: 'border-l-orange-500' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analyses</h1>
          <p className="text-slate-400 text-sm mt-1">Suivez les performances de vos ventes et l'évolution de vos revenus.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center bg-transparent border border-white/10 rounded-lg p-0.5">
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-colors">7j</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-500 text-white shadow-sm">30j</button>
            <button className="px-3 py-1.5 text-xs font-medium rounded-md text-slate-400 hover:text-white transition-colors">90j</button>
          </div>
          <button className="bg-white/5 border border-white/10 text-white px-4 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors shadow-sm flex items-center gap-2 font-medium">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Rapport
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card) => (
          <div key={card.label} className={`bg-white/5 p-5 rounded-xl border border-white/10 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 border-l-4 ${card.borderColor} relative overflow-hidden`}>
            <div className="flex justify-between items-start mb-3">
              <p className="text-xs text-slate-400 font-medium">{card.label}</p>
              <div className={`h-9 w-9 rounded-xl ${card.bgColor} flex items-center justify-center ${card.textColor}`}>
                <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight">{card.value}</h3>
            <p className="mt-2 text-xs text-slate-400">Sur les 30 derniers jours</p>
            <svg className="absolute bottom-0 left-0 w-full h-8 opacity-5" viewBox="0 0 200 30">
              <path d="M0,22 Q50,5 100,20 T200,10" fill="none" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
        ))}
      </div>

      {/* Main Chart */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-6 shadow-sm h-[400px] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white">Évolution des Revenus</h3>
          <span className="text-xs text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">30 derniers jours</span>
        </div>
        <div className="flex-1">
          <RevenueChart data={chartData} />
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Methods */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-5">Répartition par Méthode</h3>
          <div className="flex items-center justify-center py-8">
            <div className="w-40 h-40 rounded-full border-[16px] border-orange-500/20 flex items-center justify-center relative">
              <div className="absolute inset-0 rounded-full border-[16px] border-transparent border-t-orange-500 border-r-orange-500" style={{transform: 'rotate(-45deg)'}}></div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">100%</p>
                <p className="text-xs text-slate-400">MonCash</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500"></span>
              <span className="text-xs text-slate-400 font-medium">MonCash — 100%</span>
            </div>
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white/5 rounded-xl border border-white/10 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-white mb-5">Top 5 Clients</h3>
          {topClients.length > 0 ? (
            <div className="space-y-3">
              {topClients.map((client, index) => (
                <div key={client.id} className="flex items-center justify-between p-3 bg-transparent border border-white/10 rounded-xl hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center text-xs font-bold">{index + 1}</div>
                    <div>
                      <p className="text-sm font-bold text-white">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white">{client.total.toLocaleString('fr-FR')} HTG</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-3xl text-slate-500/50">leaderboard</span>
              </div>
              <p className="text-sm text-slate-400 font-medium">Pas encore de données</p>
              <p className="text-xs text-slate-500 mt-1">Le classement apparaîtra après vos premiers paiements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
