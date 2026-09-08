import { createAdminClient } from "@/utils/supabase/admin";
import { Activity, ArrowUpRight, Banknote, Power, ShieldAlert, Users } from "lucide-react";
import { getMaintenanceState } from '@/lib/server/maintenance';
import { isMaintenanceActive } from '@/lib/maintenance-state';
import { requireAdmin } from '@/lib/auth/require-admin';
import { setPlatformMaintenance } from '../health/maintenance-actions';

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const [maintenance, adminSession] = await Promise.all([
    getMaintenanceState(),
    requireAdmin(),
  ]);
  const maintenanceActive = isMaintenanceActive(maintenance);
  const maintenanceAction = setPlatformMaintenance.bind(null, !maintenanceActive);

  // Fetch basic stats
  const { count: merchantCount, error: merchantError } = await supabase.from('merchants').select('*', { count: 'exact', head: true });
  const { count: kycPending, error: kycError } = await supabase.from('merchants').select('*', { count: 'exact', head: true }).eq('kyc_status', 'in_review');
  
  // Calculate Volume and Revenue (Paiements LIVE uniquement)
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('amount, fee_amount, created_at')
    .eq('status', 'succeeded')
    .eq('environment', 'live');
  
  const totalVolume = payments?.reduce((acc, curr) => acc + Number(curr.amount || 0), 0) || 0;
  const totalRevenue = payments?.reduce((acc, curr) => acc + Number(curr.fee_amount || 0), 0) || 0;
  const systemHealthy = !merchantError && !kycError && !paymentsError;
  const today = new Date();
  const volumeByDay = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (29 - index));
    const key = date.toISOString().slice(0, 10);
    const volume = (payments || []).filter(payment => String(payment.created_at).slice(0, 10) === key).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { key, label: date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), volume };
  });
  const maxDailyVolume = Math.max(1, ...volumeByDay.map(day => day.volume));

  // Recent Activity Logs (Audit)
  const { data: recentMerchants } = await supabase
    .from('merchants')
    .select('id, business_name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">SYSTEM OVERVIEW</h1>
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-1 border rounded ${systemHealthy ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
          <Activity className="w-3 h-3" />
          {systemHealthy ? 'DATABASE OPERATIONAL' : 'SYSTEM DEGRADED'}
        </div>
      </div>

      <div className={`flex flex-col gap-4 border p-4 md:flex-row md:items-center md:justify-between ${maintenanceActive ? 'border-red-500/50 bg-red-950/20' : 'border-amber-500/30 bg-amber-950/10'}`}>
        <div className="flex items-start gap-3">
          <Power className={`mt-0.5 h-5 w-5 ${maintenanceActive ? 'text-red-400' : 'text-amber-400'}`} />
          <div>
            <p className="text-sm font-bold">{maintenanceActive ? 'SERVICES CLIENTS SUSPENDUS' : 'MAINTENANCE PROGRAMMÉE · DIMANCHE 17 H'}</p>
            <p className="mt-1 text-xs text-slate-400">{maintenanceActive ? maintenance.maintenance_message : maintenance.message}</p>
          </div>
        </div>
        <form action={maintenanceAction} className="w-full md:w-auto">
          <button type="submit" disabled={adminSession.user.role !== 'super_admin'} className={`w-full px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 md:min-w-52 ${maintenanceActive ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'}`}>
            {maintenanceActive ? 'RÉACTIVER LES SERVICES' : 'SUSPENDRE MAINTENANT'}
          </button>
        </form>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/20">
              <Banknote className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-slate-400 text-xs font-semibold mb-1 tracking-wider">TOTAL VOLUME (HTG)</div>
          <div className="text-2xl font-bold text-slate-100">{totalVolume.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-400 border border-green-500/20">
              <Activity className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-slate-400 text-xs font-semibold mb-1 tracking-wider">KOBARA REVENUE</div>
          <div className="text-2xl font-bold text-slate-100">{totalRevenue.toLocaleString()}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-slate-400 text-xs font-semibold mb-1 tracking-wider">TOTAL MERCHANTS</div>
          <div className="text-2xl font-bold text-slate-100">{merchantCount || 0}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="text-slate-400 text-xs font-semibold mb-1 tracking-wider">KYC IN REVIEW</div>
          <div className="text-2xl font-bold text-slate-100">{kycPending || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col">
          <h2 className="text-sm font-bold text-slate-300 mb-6 tracking-wider">TRANSACTION VOLUME (30 DAYS)</h2>
          <div className="h-64 flex items-end gap-1 border-b border-slate-700/50 pt-4" aria-label="Volume des transactions sur 30 jours">
            {volumeByDay.map(day => <div key={day.key} title={`${day.label}: ${day.volume.toLocaleString('fr-FR')} HTG`} className="flex-1 min-w-0 bg-blue-500/70 hover:bg-blue-400 transition-colors" style={{ height: `${Math.max(day.volume > 0 ? 4 : 1, (day.volume / maxDailyVolume) * 100)}%` }} />)}
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-2"><span>{volumeByDay[0].label}</span><span>{volumeByDay[volumeByDay.length - 1].label}</span></div>
        </div>

        {/* Recent Merchants */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-6">
          <h2 className="text-sm font-bold text-slate-300 mb-6 tracking-wider">LATEST ONBOARDINGS</h2>
          <div className="space-y-4">
            {recentMerchants?.map(merchant => (
              <div key={merchant.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-800/50">
                <div>
                  <div className="text-sm font-semibold text-slate-200">{merchant.business_name || 'Unnamed Business'}</div>
                  <div className="text-xs text-slate-500">{new Date(merchant.created_at).toLocaleDateString()}</div>
                </div>
                <div className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded">NEW</div>
              </div>
            ))}
            {(!recentMerchants || recentMerchants.length === 0) && (
              <div className="text-sm text-slate-500 text-center py-4">No merchants found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
