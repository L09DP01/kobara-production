"use client"
import { useEffect, useState } from "react"
import { ShieldAlert, AlertTriangle, ShieldCheck } from "lucide-react"

export function RiskOverviewCards() {
  const [data, setData] = useState({ critical: 0, high: 0, alerts: 0 })

  useEffect(() => {
    fetch("/api/admin/risk/overview")
      .then(async r => {
        if (!r.ok) return { critical_merchants: 0, high_risk_merchants: 0, open_alerts: 0 }
        return r.json().catch(() => ({ critical_merchants: 0, high_risk_merchants: 0, open_alerts: 0 }))
      })
      .then(d => setData({ critical: d.critical_merchants, high: d.high_risk_merchants, alerts: d.open_alerts }))
      .catch(() => setData({ critical: 0, high: 0, alerts: 0 }))
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-[#0A1628] border border-red-500/30 rounded-xl p-5 flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-red-500/10 rounded-lg text-red-500"><ShieldAlert className="w-8 h-8" /></div>
        <div>
          <p className="text-sm text-slate-400 font-medium">Marchands Critiques</p>
          <h3 className="text-2xl font-bold text-white">{data.critical}</h3>
        </div>
      </div>
      <div className="bg-[#0A1628] border border-orange-500/30 rounded-xl p-5 flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500"><AlertTriangle className="w-8 h-8" /></div>
        <div>
          <p className="text-sm text-slate-400 font-medium">Risque Élevé</p>
          <h3 className="text-2xl font-bold text-white">{data.high}</h3>
        </div>
      </div>
      <div className="bg-[#0A1628] border border-[#FF4A1C]/30 rounded-xl p-5 flex items-center gap-4 shadow-lg">
        <div className="p-3 bg-[#FF4A1C]/10 rounded-lg text-[#FF4A1C]"><ShieldCheck className="w-8 h-8" /></div>
        <div>
          <p className="text-sm text-slate-400 font-medium">Alertes Ouvertes</p>
          <h3 className="text-2xl font-bold text-white">{data.alerts}</h3>
        </div>
      </div>
    </div>
  )
}
