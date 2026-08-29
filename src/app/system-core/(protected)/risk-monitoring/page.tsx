import { RiskOverviewCards } from "@/components/admin/risk/RiskOverviewCards"
import { MerchantRiskTable } from "@/components/admin/risk/MerchantRiskTable"
import { RiskAlertsFeed } from "@/components/admin/risk/RiskAlertsFeed"
import { BotStatusBadge } from "@/components/admin/risk/BotStatusBadge"

export const metadata = {
  title: 'Risk Monitoring | Kobara Admin',
}

export default function RiskMonitoringPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-white/5 pb-5">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Risk Monitoring</h1>
          <p className="text-slate-400 mt-1">Supervision en temps réel des risques marchands (Règles système + Moteur IA).</p>
        </div>
        <BotStatusBadge />
      </div>

      <RiskOverviewCards />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-[#0A1628] border border-white/10 rounded-xl p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4">Marchands sous surveillance</h2>
            <MerchantRiskTable />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-[#0A1628] border border-white/10 rounded-xl p-5 shadow-lg h-[600px] flex flex-col">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
              Feed d'Alertes
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">Live</span>
            </h2>
            <RiskAlertsFeed />
          </div>
        </div>
      </div>
    </div>
  )
}
