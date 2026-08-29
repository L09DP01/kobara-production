"use client"
import { useEffect, useState } from "react"

export function RiskAlertsFeed() {
  const [alerts, setAlerts] = useState<any[]>([])

  useEffect(() => {
    fetch("/api/admin/risk/alerts")
      .then(async r => {
        if (!r.ok) return { data: [] }
        return r.json().catch(() => ({ data: [] }))
      })
      .then(d => setAlerts(d.data || []))
      .catch(() => setAlerts([]))
  }, [])

  return (
    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
      {alerts.length === 0 && <div className="text-center text-slate-500 py-8">Aucune alerte récente.</div>}
      {alerts.map(alert => (
        <div key={alert.id} className="bg-[#112240] border border-white/5 p-4 rounded-lg">
          <div className="flex justify-between items-start mb-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase
              ${alert.severity === 'critical' ? 'bg-red-500 text-white' : 
                alert.severity === 'high' ? 'bg-orange-500 text-white' : 
                'bg-slate-700 text-slate-300'}`}>
              {alert.severity}
            </span>
            <span className="text-xs text-slate-500">{new Date(alert.created_at).toLocaleTimeString()}</span>
          </div>
          <p className="text-sm text-white font-medium mb-1">{alert.alert_type}</p>
          <p className="text-xs text-slate-400 mb-3">{alert.description}</p>
          <div className="flex justify-between items-center">
            <span className="font-mono text-[10px] text-slate-500">Marchand: {alert.merchant_id.split('-')[0]}...</span>
            {alert.status === 'open' && (
              <button className="text-xs text-[#FF4A1C] hover:underline font-medium">Investiguer</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
